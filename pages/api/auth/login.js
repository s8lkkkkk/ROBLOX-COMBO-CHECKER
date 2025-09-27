// pages/api/auth/login.js
export default function handler(req, res) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) {
    res.status(500).send('DISCORD_CLIENT_ID not set in environment variables.');
    return;
  }

  const redirectUri = encodeURIComponent(process.env.DISCORD_REDIRECT_URI || `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ''}/api/auth/callback`);
  const scopes = encodeURIComponent(process.env.SCOPES || 'identify email guilds');
  const state = encodeURIComponent(Math.random().toString(36).slice(2));

  const url = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scopes}&state=${state}&prompt=consent`;
  res.writeHead(302, { Location: url });
  res.end();
}
