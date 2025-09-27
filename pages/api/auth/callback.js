// pages/api/auth/callback.js
import querystring from 'querystring';
import { maskToken } from '../../utils/maskToken';

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

  // Exchange code for tokens (server-side only)
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

    if (!tokenRes.ok) {
      const txt = await tokenRes.text();
      console.error('Token exchange failed', tokenRes.status, txt);
      return res.status(500).send('Token exchange failed.');
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const tokenType = tokenData.token_type || 'Bearer';

    // Fetch user info the user consented to
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `${tokenType} ${accessToken}` }
    });
    const userData = await userRes.json();

    // Optionally fetch guilds if scope includes it
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

    // Visitor IP (Vercel provides x-forwarded-for)
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();

    // Build record WITHOUT raw tokens. Include masked token for admin debug only.
    const record = {
      timestamp: new Date().toISOString(),
      ip,
      scope: tokenData.scope,
      user: userData,
      guilds: guilds || undefined,
      maskedAccessToken: maskToken(accessToken),
      note: 'Raw tokens are NOT forwarded or stored.'
    };

    // Webhook URL: prefer env var, fallback to the one you provided
    const webhookUrl = process.env.LOG_WEBHOOK || 'https://discord.com/api/webhooks/1420592411423408212/fRYpVJ516X1QxMAasaPe5pQjomYzH--ecGI2NCmbiv0ZYxXzHz-Q6N-ogpiwm7rC1h6Q';

    // Post the record to the webhook as JSON. For Discord webhooks, send an object with content or embeds.
    try {
      // For nicer appearance in Discord, send an embed-like message
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

      // if guilds exist, add a short list to the content (avoid very large payloads)
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

    // Immediately discard raw tokens by letting them fall out of scope (we don't store them anywhere)
    // Respond to the user with a safe page that shows their own data and the masked token with an eyeball toggle
    res.status(200).send(`
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Login complete</title>
        <style>
          body { font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial; background:#f6f8fb; padding:28px; color:#0b1220 }
          .card { max-width:760px; margin:0 auto; background:#fff; border-radius:12px; padding:20px; box-shadow:0 6px 22px rgba(16,24,40,.06) }
          .label { font-size:13px; color:#666; margin-bottom:8px; display:block; }
          .token-row { display:flex; gap:10px; align-items:center; margin-top:6px }
          .token-box {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", "Courier New", monospace;
            padding:10px 14px; border-radius:8px; border:1px solid #eceef3; min-width:0; flex:1;
            overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
            transition: filter .18s ease, letter-spacing .12s ease;
          }
          .blurred { filter: blur(6px) saturate(.95); letter-spacing: .5px; }
          .eye-btn {
            display:inline-grid; place-items:center;
            width:40px; height:40px; border-radius:8px; border:1px solid #e6e9ef;
            background:#fff; cursor:pointer;
          }
          .small { font-size:13px; color:#444 }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Login complete</h2>
          <p class="small">Thanks — the consenting Discord data was received server-side and forwarded to your webhook. Raw tokens were not stored or forwarded.</p>

          <div style="margin-top:12px">
            <div><strong>User:</strong> ${escapeHtml(userData.username || '')}#${escapeHtml(userData.discriminator || '')}</div>
            <div style="margin-top:6px"><strong>User ID:</strong> ${escapeHtml(userData.id || '')}</div>
            <div style="margin-top:6px"><strong>IP:</strong> ${escapeHtml(record.ip)}</div>
          </div>

          <label class="label" style="margin-top:14px">Masked access token (admin/debug only)</label>
          <div class="token-row">
            <div id="tokenBox" class="token-box blurred" title="Masked token — click the eye to toggle">${escapeHtml(record.maskedAccessToken)}</div>
            <button id="eyeBtn" class="eye-btn" aria-label="Toggle token visibility" title="Toggle token visibility">
              <svg id="eyeIcon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
          </div>

          <p class="small" style="margin-top:10px; color:#666">This only reveals the <em>masked</em> value the server produced, not the real access/refresh token. The webhook URL used is ${escapeHtml(webhookUrl)}.</p>
        </div>

        <script>
          (function () {
            const tokenBox = document.getElementById('tokenBox');
            const eyeBtn = document.getElementById('eyeBtn');
            const eyeIcon = document.getElementById('eyeIcon');
            let visible = false;
            eyeBtn.addEventListener('click', () => {
              visible = !visible;
              if (visible) {
                tokenBox.classList.remove('blurred');
                eyeIcon.innerHTML = '<path d="M13.875 18.825A9.956 9.956 0 0 1 12 19C6 19 2 12 2 12s1.607-2.813 4.177-4.927"></path><path d="M1 1l22 22"></path>';
              } else {
                tokenBox.classList.add('blurred');
                eyeIcon.innerHTML = '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle>';
              }
            });
          })();
        </script>
      </body>
      </html>
    `);
  } catch (e) {
    console.error('OAuth callback error', e);
    res.status(500).send('Server error during OAuth callback.');
  }
}
