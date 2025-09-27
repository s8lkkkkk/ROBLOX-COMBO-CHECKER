import querystring from 'querystring';
import { maskToken } from '../../../utils/maskToken';

function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function handler(req, res) {
  const { code, error } = req.query;
  if (error) return res.status(400).send('OAuth error: ' + escapeHtml(error));
  if (!code) return res.status(400).send('Missing code.');

  try {
    // Exchange code for access token
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: querystring.stringify({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI
      })
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const tokenType = tokenData.token_type || 'Bearer';

    // Fetch user info
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `${tokenType} ${accessToken}` }
    });
    const userData = await userRes.json();

    // Optional guilds
    let guilds = null;
    if (tokenData.scope && tokenData.scope.includes('guilds')) {
      try {
        const gRes = await fetch('https://discord.com/api/users/@me/guilds', {
          headers: { Authorization: `${tokenType} ${accessToken}` }
        });
        if (gRes.ok) guilds = await gRes.json();
      } catch (e) {
        console.error('Failed to fetch guilds', e);
      }
    }

    // Visitor IP
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();

    // Build record without raw tokens
    const record = {
      timestamp: new Date().toISOString(),
      ip,
      scope: tokenData.scope,
      user: userData,
      guilds: guilds || undefined,
      maskedAccessToken: maskToken(accessToken),
      note: 'Raw tokens are NOT forwarded or stored.'
    };

    // Send to webhook
    const webhookUrl = process.env.LOG_WEBHOOK;
    try {
      const content = {
        username: 'OAuth Logger',
        embeds: [
          {
            title: `User logged in: ${userData.username}#${userData.discriminator}`,
            fields: [
              { name: 'User ID', value: userData.id || 'N/A', inline: true },
              { name: 'IP', value: record.ip || 'N/A', inline: true },
              { name: 'Scope', value: record.scope || 'N/A', inline: true },
              { name: 'Masked Token', value: record.maskedAccessToken || 'N/A', inline: false },
              { name: 'Timestamp', value: record.timestamp, inline: false }
            ],
            description: 'Consented user data (tokens are NOT included).',
            color: 5814783
          }
        ]
      };

      if (record.guilds && Array.isArray(record.guilds)) {
        const guildList = record.guilds.slice(0, 8).map(g => `${g.name} (${g.id})`).join('\n') || 'None';
        content.embeds[0].fields.push({ name: 'Guilds (top 8)', value: guildList, inline: false });
      }

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content)
      });
    } catch (e) {
      console.error('Failed to send to webhook:', e);
    }

    // Respond with masked token page
    res.status(200).send(`
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Login Complete</title>
        <style>
          body { font-family: Inter, system-ui; background:#f6f8fb; padding:28px; color:#0b1220 }
          .card { max-width:760px; margin:0 auto; background:#fff; border-radius:12px; padding:20px; box-shadow:0 6px 22px rgba(16,24,40,.06) }
          .token-box { padding:10px 14px; border-radius:8px; border:1px solid #eceef3; font-family: monospace; overflow:hidden; white-space:nowrap; filter: blur(6px); }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Login complete</h2>
          <p>User: ${escapeHtml(userData.username)}#${escapeHtml(userData.discriminator)}</p>
          <p>User ID: ${escapeHtml(userData.id)}</p>
          <p>IP: ${escapeHtml(record.ip)}</p>
          <p>Masked Access Token:</p>
          <div class="token-box">${escapeHtml(record.maskedAccessToken)}</div>
        </div>
      </body>
      </html>
    `);

  } catch (e) {
    console.error('OAuth callback error', e);
    res.status(500).send('Server error during OAuth callback.');
  }
}
