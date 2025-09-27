import express from 'express';
import fetch from 'node-fetch';

const app = express();

// Replace these with your values directly
const CLIENT_ID = "1421616821995442306";
const CLIENT_SECRET = "OYp8SMFd7NTQcS6lyLXTl-x86cAKqJuZ";
const REDIRECT_URI = "http://localhost:3000/callback";
const BOT_TOKEN = "YOUR_BOT_TOKEN";

app.get('/send-dm', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('Missing code');

  try {
    // Exchange OAuth2 code for access token
    const data = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI
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

    // Create DM channel
    const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ recipient_id: user.id })
    });
    const dmChannel = await dmRes.json();

    // Send embed DM
    const embed = {
      embeds: [
        {
          title: "Hello from OAuth2 Demo!",
          description: `Hi ${user.username}, you just logged in!`,
          color: 0x5865F2
        }
      ]
    };

    await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(embed)
    });

    res.json({ success: true, user });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
