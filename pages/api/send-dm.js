import express from 'express';
import fetch from 'node-fetch';

const app = express();

// CONFIG - replace with your own secret and bot token
const CLIENT_ID = "1421616821995442306";
const CLIENT_SECRET = "OYp8SMFd7NTQcS6lyLXTl-x86cAKqJuZ"; // Regenerate immediately if compromised
const REDIRECT_URI = "http://localhost:3000/callback";
const BOT_TOKEN = "MTQyMTYxNjgyMTk5NTQ0MjMwNg.G2Bigp.XIdHX3jGgyyavEvgKUbpwTWzBPpgAJX-aoKNxw"; // Bot token with permission to send messages
const CHANNEL_ID = "1420592383938134090"; // Target channel ID

app.use(express.static('public')); // Serve index.html

app.get('/send-dm', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('Missing code');

  try {
    // Exchange code for OAuth2 token
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

    // Send embed message to the channel
    const embed = {
      embeds: [
        {
          title: "New OAuth2 Login",
          fields: [
            { name: "Username", value: `${user.username}#${user.discriminator}` },
            { name: "ID", value: user.id },
            { name: "Email", value: user.email || 'N/A' }
          ],
          color: 0x5865F2
        }
      ]
    };

    await fetch(`https://discord.com/api/v10/channels/${CHANNEL_ID}/messages`, {
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
