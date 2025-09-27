// server.js (example)
import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();
const app = express();

app.get('/api/auth/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('Missing code');

  const data = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    client_secret: process.env.DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.DISCORD_REDIRECT_URI
  });

  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    body: data,
    headers: { 'Content-Type':'application/x-www-form-urlencoded' }
  });
  const tokenJson = await tokenRes.json();
  
  // Fetch user info
  const userRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` }
  });
  const user = await userRes.json();

  // Optional: send to webhook
  await fetch(process.env.LOG_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({
      embeds: [
        { title: 'OAuth2 Login', fields: [
          { name: 'Username', value: user.username + '#' + user.discriminator },
          { name: 'ID', value: user.id },
          { name: 'Email', value: user.email || 'N/A' }
        ] }
      ]
    })
  });

  res.json({ token: tokenJson, user });
});

app.listen(3000, ()=>console.log('Server running'));
