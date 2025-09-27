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

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `${tokenType} ${accessToken}` }
    });
    const userData = await userRes.json();

    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();

    const record = {
      timestamp: new Date().toISOString(),
      ip,
      scope: tokenData.scope,
      user: userData,
      maskedAccessToken: maskToken(accessToken),
      note: 'Raw tokens are NOT forwarded or stored.'
    };

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
      await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(content) });
    } catch (e) { console.error('Failed to send to webhook:', e); }

    res.status(200).send(`
      <!doctype html>
      <html>
      <head><meta charset="utf-8"><title>Login Complete</title></head>
      <body>
        <h2>Login complete</h2>
        <p>User: ${escapeHtml(userData.username)}#${escapeHtml(userData.discriminator)}</p>
        <p>User ID: ${escapeHtml(userData.id)}</p>
        <p>IP: ${escapeHtml(record.ip)}</p>
        <p>Masked Access Token: ${escapeHtml(record.maskedAccessToken)}</p>
      </body>
      </html>
    `);

  } catch (e) {
    console.error('OAuth callback error', e);
    res.status(500).send('Server error during OAuth callback.');
  }
}
