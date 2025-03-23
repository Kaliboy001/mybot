const { Telegraf } = require('telegraf');
const mongoose = require('mongoose');
const isgd = require('isgd');
const crypto = require('crypto');

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('Missing MONGO_URI environment variable');
  process.exit(1);
}

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Owner ID
const OWNER_ID = process.env.OWNER_ID;

if (!OWNER_ID) {
  console.error('Missing OWNER_ID environment variable');
  process.exit(1);
}

// MongoDB Models
const BotSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  creatorId: { type: String, required: true },
  createdAt: { type: Number, default: () => Math.floor(Date.now() / 1000) },
});

const BotUserSchema = new mongoose.Schema({
  botToken: { type: String, required: true },
  userId: { type: String, required: true },
  hasJoined: { type: Boolean, default: false },
  userStep: { type: String, default: 'none' },
  adminState: { type: String, default: 'none' },
  lastInteraction: { type: Number, default: () => Math.floor(Date.now() / 1000) },
  isBlocked: { type: Boolean, default: false },
  username: { type: String },
  referredBy: { type: String, default: 'None' },
  isFirstStart: { type: Boolean, default: true },
});

const SessionSchema = new mongoose.Schema({
  sessionToken: { type: String, required: true, unique: true },
  botToken: { type: String, required: true },
  chatId: { type: String, required: true },
  createdAt: { type: Number, default: () => Math.floor(Date.now() / 1000) },
  expiresAt: { type: Number, default: () => Math.floor(Date.now() / 1000) + 600 },
});

BotUserSchema.index({ botToken: 1, userId: 1 }, { unique: true });
BotUserSchema.index({ botToken: 1, hasJoined: 1 });
SessionSchema.index({ sessionToken: 1 }, { unique: true });
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const ChannelUrlSchema = new mongoose.Schema({
  botToken: { type: String, required: true, unique: true },
  defaultUrl: { type: String, default: 'https://t.me/Kali_Linux_BOTS' },
  customUrl: { type: String, default: null },
});

const Bot = mongoose.model('Bot', BotSchema);
const BotUser = mongoose.model('BotUser', BotUserSchema);
const ChannelUrl = mongoose.model('ChannelUrl', ChannelUrlSchema);
const Session = mongoose.model('Session', SessionSchema);

// Admin Panel Keyboard
const adminPanel = {
  reply_markup: {
    keyboard: [
      [{ text: '📊 Statistics' }],
      [{ text: '📍 Broadcast' }],
      [{ text: '🔗 Set Channel URL' }],
      [{ text: '🚫 Block' }],
      [{ text: '🔓 Unlock' }],
      [{ text: '↩️ Back' }],
    ],
    resize_keyboard: true,
  },
};

// Cancel Keyboard
const cancelKeyboard = {
  reply_markup: {
    keyboard: [[{ text: 'Cancel' }]],
    resize_keyboard: true,
  },
};

// Helper Functions
const getChannelUrl = async (botToken) => {
  try {
    const channelUrlDoc = await ChannelUrl.findOne({ botToken }).lean();
    return {
      defaultUrl: channelUrlDoc?.defaultUrl || 'https://t.me/Kali_Linux_BOTS',
      customUrl: channelUrlDoc?.customUrl || null,
    };
  } catch (error) {
    console.error('Error in getChannelUrl:', error);
    return {
      defaultUrl: 'https://t.me/Kali_Linux_BOTS',
      customUrl: null,
    };
  }
};

const shortenUrl = async (longUrl) => {
  return new Promise((resolve) => {
    isgd.shorten(longUrl, (shortUrl, error) => {
      if (error) {
        console.error('Error shortening URL:', error);
        resolve(longUrl);
      } else {
        resolve(shortUrl);
      }
    });
  });
};

const generateSessionToken = () => {
  return crypto.randomBytes(16).toString('hex');
};

const broadcastMessage = async (bot, message, targetUsers, adminId) => {
  let successCount = 0;
  let failCount = 0;

  for (const targetUser of targetUsers) {
    if (targetUser.userId === adminId) continue;
    try {
      if (message.text) {
        await bot.telegram.sendMessage(targetUser.userId, message.text);
      } else if (message.photo) {
        const photo = message.photo[message.photo.length - 1].file_id;
        await bot.telegram.sendPhoto(targetUser.userId, photo, { caption: message.caption || '' });
      } else if (message.document) {
        await bot.telegram.sendDocument(targetUser.userId, message.document.file_id, { caption: message.caption || '' });
      } else if (message.video) {
        await bot.telegram.sendVideo(targetUser.userId, message.video.file_id, { caption: message.caption || '' });
      } else if (message.audio) {
        await bot.telegram.sendAudio(targetUser.userId, message.audio.file_id, { caption: message.caption || '' });
      } else if (message.voice) {
        await bot.telegram.sendVoice(targetUser.userId, message.voice.file_id);
      } else if (message.sticker) {
        await bot.telegram.sendSticker(targetUser.userId, message.sticker.file_id);
      } else {
        await bot.telegram.sendMessage(targetUser.userId, 'Unsupported message type');
      }
      successCount++;
      await new Promise(resolve => setTimeout(resolve, 34));
    } catch (error) {
      console.error(`Broadcast failed for user ${targetUser.userId}:`, error.message);
      failCount++;
    }
  }

  return { successCount, failCount };
};

const getRelativeTime = (timestamp) => {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  const date = new Date(timestamp * 1000);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dateStr = `${month}/${day}`;

  if (diff < 60) return `${dateStr}, ${diff} seconds ago`;
  if (diff < 3600) return `${dateStr}, ${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${dateStr}, ${Math.floor(diff / 3600)} hours ago`;
  return `${dateStr}, ${Math.floor(diff / 86400)} days ago`;
};

// Vercel Handler
module.exports = async (req, res) => {
  try {
    console.log(`Received request: ${req.method} ${req.url}`);
    console.log('Request body:', req.body);

    // Handle Telegram updates (POST /<botToken>)
    if (req.method === 'POST' && req.url.startsWith('/')) {
      const pathParts = req.url.split('/');
      const botToken = pathParts[1] || req.query.token; // Try URL path first, then query
      console.log('Extracted botToken:', botToken);

      if (!botToken) {
        console.error('No bot token provided in URL or query');
        res.status(400).json({ error: 'No bot token provided' });
        return;
      }

      const botInfo = await Bot.findOne({ token: botToken });
      if (!botInfo) {
        console.error('Bot not found for token:', botToken);
        res.status(404).json({ error: 'Bot not found' });
        return;
      }

      const bot = new Telegraf(botToken);
      const update = req.body;
      console.log('Received Telegram update:', update);

      const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
      const fromId = (update.message?.from?.id || update.callback_query?.from?.id)?.toString();

      if (!chatId || !fromId) {
        console.error('Invalid update: missing chatId or fromId', update);
        res.status(400).json({ error: 'Invalid update' });
        return;
      }

      // Initialize Bot User
      let botUser = await BotUser.findOne({ botToken, userId: fromId });
      if (!botUser) {
        const username = update.message?.from?.username ? `@${update.message.from.username}` : update.message?.from?.first_name;
        const referredBy = update.message?.text?.split(' ')[1] || 'None';
        botUser = await BotUser.create({
          botToken,
          userId: fromId,
          hasJoined: false,
          userStep: 'none',
          adminState: 'none',
          isBlocked: false,
          username,
          referredBy,
          isFirstStart: true,
        });
        console.log('Created new bot user:', botUser);
      }

      if (botUser.isFirstStart) {
        try {
          const totalUsers = await BotUser.countDocuments({ botToken, hasJoined: true });
          const notification = `➕ New User Notification ➕\n` +
                              `👤 User: ${botUser.username}\n` +
                              `🆔 User ID: ${fromId}\n` +
                              `⭐ Referred By: ${botUser.referredBy}\n` +
                              `📊 Total Users of Bot: ${totalUsers}`;
          await bot.telegram.sendMessage(botInfo.creatorId, notification);
          botUser.isFirstStart = false;
        } catch (error) {
          console.error('Error sending new user notification:', error);
        }
      }

      botUser.lastInteraction = Math.floor(Date.now() / 1000);
      await botUser.save();

      if (botUser.isBlocked && fromId !== botInfo.creatorId && fromId !== OWNER_ID) {
        await bot.telegram.sendMessage(chatId, '🚫 You have been banned by the admin.');
        return res.status(200).json({ ok: true });
      }

      const { defaultUrl, customUrl } = await getChannelUrl(botToken);

      // Handle Messages
      if (update.message) {
        const message = update.message;
        const text = message.text;
        console.log('Received message:', text);

        if (text === '/start') {
          try {
            const inlineKeyboard = [];
            inlineKeyboard.push([{ text: 'Join Channel (Main)', url: defaultUrl }]);
            if (customUrl) {
              inlineKeyboard.push([{ text: 'Join Channel (Custom)', url: customUrl }]);
            }
            inlineKeyboard.push([{ text: 'Joined', callback_data: 'joined' }]);

            await bot.telegram.sendMessage(chatId, 'Please join our channel(s) and click "Joined" to proceed.', {
              reply_markup: {
                inline_keyboard: inlineKeyboard,
              },
            });
            botUser.userStep = 'none';
            botUser.adminState = 'none';
            await botUser.save();
            console.log('Sent /start response to chatId:', chatId);
          } catch (error) {
            console.error('Error in /start:', error);
            await bot.telegram.sendMessage(chatId, '❌ Error occurred. Try again.');
          }
        }

        else if (text === '/panel' && (fromId === botInfo.creatorId || fromId === OWNER_ID)) {
          try {
            await bot.telegram.sendMessage(chatId, '🔧 Admin Panel', adminPanel);
            botUser.adminState = 'admin_panel';
            await botUser.save();
            console.log('Sent /panel response to chatId:', chatId);
          } catch (error) {
            console.error('Error in /panel:', error);
            await bot.telegram.sendMessage(chatId, '❌ Error occurred. Try again.');
          }
        }

        else if ((fromId === botInfo.creatorId || fromId === OWNER_ID) && botUser.adminState === 'admin_panel') {
          if (text === '📊 Statistics') {
            try {
              const userCount = await BotUser.countDocuments({ botToken, hasJoined: true });
              const createdAt = getRelativeTime(botInfo.createdAt);
              const message = `📊 Statistics for @${botInfo.username}\n\n` +
                             `👥 Total Users: ${userCount}\n` +
                             `📅 Bot Created: ${createdAt}\n` +
                             `🔗 Main Channel URL: ${defaultUrl}\n` +
                             (customUrl ? `🔗 Custom Channel URL: ${customUrl}` : '🔗 Custom Channel URL: Not set');
              await bot.telegram.sendMessage(chatId, message, adminPanel);
              console.log('Sent Statistics to chatId:', chatId);
            } catch (error) {
              console.error('Error in Statistics:', error);
              await bot.telegram.sendMessage(chatId, '❌ Error fetching stats.');
            }
          } else if (text === '📍 Broadcast') {
            try {
              const userCount = await BotUser.countDocuments({ botToken, hasJoined: true });
              if (userCount === 0) {
                await bot.telegram.sendMessage(chatId, '❌ No users joined yet.', adminPanel);
              } else {
                await bot.telegram.sendMessage(chatId, `📢 Send message to broadcast to ${userCount} users:`, cancelKeyboard);
                botUser.adminState = 'awaiting_broadcast';
                await botUser.save();
              }
              console.log('Set up broadcast for chatId:', chatId);
            } catch (error) {
              console.error('Error in Broadcast setup:', error);
              await bot.telegram.sendMessage(chatId, '❌ Error occurred.');
            }
          } else if (text === '🔗 Set Channel URL') {
            try {
              await bot.telegram.sendMessage(chatId,
                `🔗 Main Channel URL (Constant):\n${defaultUrl}\n\n` +
                `🔗 Custom Channel URL:\n${customUrl || 'Not set'}\n\n` +
                `Enter custom channel URL (e.g., https://t.me/your_channel):`,
                cancelKeyboard
              );
              botUser.adminState = 'awaiting_channel';
              await botUser.save();
              console.log('Set up channel URL for chatId:', chatId);
            } catch (error) {
              console.error('Error in Set Channel URL:', error);
              await bot.telegram.sendMessage(chatId, '❌ Error occurred.');
            }
          } else if (text === '🚫 Block') {
            try {
              await bot.telegram.sendMessage(chatId, '🚫 Enter user ID to block:', cancelKeyboard);
              botUser.adminState = 'awaiting_block';
              await botUser.save();
              console.log('Set up block for chatId:', chatId);
            } catch (error) {
              console.error('Error in Block setup:', error);
              await bot.telegram.sendMessage(chatId, '❌ Error occurred.');
            }
          } else if (text === '🔓 Unlock') {
            try {
              await bot.telegram.sendMessage(chatId, '🔓 Enter user ID to unblock:', cancelKeyboard);
              botUser.adminState = 'awaiting_unlock';
              await botUser.save();
              console.log('Set up unlock for chatId:', chatId);
            } catch (error) {
              console.error('Error in Unlock setup:', error);
              await bot.telegram.sendMessage(chatId, '❌ Error occurred.');
            }
          } else if (text === '↩️ Back') {
            try {
              await bot.telegram.sendMessage(chatId, '↩️ Returned to normal mode.', {
                reply_markup: { remove_keyboard: true },
              });
              botUser.adminState = 'none';
              await botUser.save();
              console.log('Returned to normal mode for chatId:', chatId);
            } catch (error) {
              console.error('Error in Back action:', error);
              await bot.telegram.sendMessage(chatId, '❌ Error occurred.');
            }
          }
        }

        else if ((fromId === botInfo.creatorId || fromId === OWNER_ID) && botUser.adminState === 'awaiting_broadcast') {
          if (text === 'Cancel') {
            try {
              await bot.telegram.sendMessage(chatId, '↩️ Broadcast cancelled.', adminPanel);
              botUser.adminState = 'admin_panel';
              await botUser.save();
              console.log('Cancelled broadcast for chatId:', chatId);
            } catch (error) {
              console.error('Error cancelling broadcast:', error);
            }
            return;
          }

          try {
            const targetUsers = await BotUser.find({ botToken, hasJoined: true, isBlocked: false });
            const { successCount, failCount } = await broadcastMessage(bot, message, targetUsers, fromId);

            await bot.telegram.sendMessage(chatId,
              `📢 Broadcast completed!\n` +
              `✅ Sent to ${successCount} users\n` +
              `❌ Failed for ${failCount} users`,
              adminPanel
            );
            botUser.adminState = 'admin_panel';
            await botUser.save();
            console.log('Completed broadcast for chatId:', chatId);
          } catch (error) {
            console.error('Error in broadcast:', error);
            await bot.telegram.sendMessage(chatId, '❌ Error during broadcast.');
          }
        }

        else if ((fromId === botInfo.creatorId || fromId === OWNER_ID) && botUser.adminState === 'awaiting_channel') {
          if (text === 'Cancel') {
            try {
              await bot.telegram.sendMessage(chatId, '↩️ Channel URL setting cancelled.', adminPanel);
              botUser.adminState = 'admin_panel';
              await botUser.save();
              console.log('Cancelled channel URL setting for chatId:', chatId);
            } catch (error) {
              console.error('Error cancelling channel URL:', error);
            }
            return;
          }

          try {
            let inputUrl = text.trim();
            inputUrl = inputUrl.replace(/^(https?:\/\/)?/i, '');
            inputUrl = inputUrl.replace(/\/+$/, '');
            if (!/^t\.me\//i.test(inputUrl)) {
              inputUrl = 't.me/' + inputUrl;
            }
            const correctedUrl = 'https://' + inputUrl;

            const urlRegex = /^https:\/\/t\.me\/.+$/;
            if (!urlRegex.test(correctedUrl)) {
              await bot.telegram.sendMessage(chatId, '❌ Invalid URL. Use a valid Telegram channel URL.', cancelKeyboard);
              return;
            }

            await ChannelUrl.findOneAndUpdate(
              { botToken },
              { botToken, defaultUrl: 'https://t.me/Kali_Linux_BOTS', customUrl: correctedUrl },
              { upsert: true }
            );

            await bot.telegram.sendMessage(chatId, `✅ Custom Channel URL set to:\n${correctedUrl}\nMain URL remains:\n${defaultUrl}`, adminPanel);
            botUser.adminState = 'admin_panel';
            await botUser.save();
            console.log('Set custom channel URL for chatId:', chatId);
          } catch (error) {
            console.error('Error setting channel URL:', error);
            await bot.telegram.sendMessage(chatId, '❌ Error setting URL.');
          }
        }

        else if ((fromId === botInfo.creatorId || fromId === OWNER_ID) && botUser.adminState === 'awaiting_block') {
          if (text === 'Cancel') {
            try {
              await bot.telegram.sendMessage(chatId, '↩️ Block action cancelled.', adminPanel);
              botUser.adminState = 'admin_panel';
              await botUser.save();
              console.log('Cancelled block for chatId:', chatId);
            } catch (error) {
              console.error('Error cancelling block:', error);
            }
            return;
          }

          try {
            const targetUserId = text.trim();
            if (!/^\d+$/.test(targetUserId)) {
              await bot.telegram.sendMessage(chatId, '❌ Invalid user ID. Use numbers only.', cancelKeyboard);
              return;
            }

            if (targetUserId === fromId) {
              await bot.telegram.sendMessage(chatId, '❌ Cannot block yourself.', cancelKeyboard);
              return;
            }

            const targetUser = await BotUser.findOne({ botToken, userId: targetUserId });
            if (!targetUser) {
              await bot.telegram.sendMessage(chatId, '❌ User not found.', adminPanel);
              botUser.adminState = 'admin_panel';
              await botUser.save();
              return;
            }

            await BotUser.findOneAndUpdate({ botToken, userId: targetUserId }, { isBlocked: true });
            await bot.telegram.sendMessage(chatId, `✅ User ${targetUserId} blocked.`, adminPanel);
            botUser.adminState = 'admin_panel';
            await botUser.save();
            console.log('Blocked user for chatId:', chatId);
          } catch (error) {
            console.error('Error in block action:', error);
            await bot.telegram.sendMessage(chatId, '❌ Error blocking user.');
          }
        }

        else if ((fromId === botInfo.creatorId || fromId === OWNER_ID) && botUser.adminState === 'awaiting_unlock') {
          if (text === 'Cancel') {
            try {
              await bot.telegram.sendMessage(chatId, '↩️ Unlock action cancelled.', adminPanel);
              botUser.adminState = 'admin_panel';
              await botUser.save();
              console.log('Cancelled unlock for chatId:', chatId);
            } catch (error) {
              console.error('Error cancelling unlock:', error);
            }
            return;
          }

          try {
            const targetUserId = text.trim();
            if (!/^\d+$/.test(targetUserId)) {
              await bot.telegram.sendMessage(chatId, '❌ Invalid user ID. Use numbers only.', cancelKeyboard);
              return;
            }

            const targetUser = await BotUser.findOne({ botToken, userId: targetUserId });
            if (!targetUser) {
              await bot.telegram.sendMessage(chatId, '❌ User not found.', adminPanel);
              botUser.adminState = 'admin_panel';
              await botUser.save();
              return;
            }

            await BotUser.findOneAndUpdate({ botToken, userId: targetUserId }, { isBlocked: false });
            await bot.telegram.sendMessage(chatId, `✅ User ${targetUserId} unblocked.`, adminPanel);
            botUser.adminState = 'admin_panel';
            await botUser.save();
            console.log('Unblocked user for chatId:', chatId);
          } catch (error) {
            console.error('Error in unlock action:', error);
            await bot.telegram.sendMessage(chatId, '❌ Error unblocking user.');
          }
        }
      }

      // Handle Callbacks
      if (update.callback_query) {
        const callbackQuery = update.callback_query;
        const callbackData = callbackQuery.data;
        const callbackQueryId = callbackQuery.id;
        console.log('Received callback:', callbackData);

        if (callbackData === 'joined') {
          try {
            botUser.hasJoined = true;
            await botUser.save();

            const username = botUser.username || 'User';
            const welcomeMessage = `Hey ${username}, welcome! Choose from the menu:`;
            const menuKeyboard = {
              reply_markup: {
                inline_keyboard: [
                  [{ text: 'Help', callback_data: 'help' }],
                  [{ text: 'Info', callback_data: 'info' }],
                ],
              },
            };

            await bot.telegram.answerCbQuery(callbackQueryId, 'Thanks for proceeding!');
            await bot.telegram.sendMessage(chatId, welcomeMessage, menuKeyboard);
            console.log('Sent welcome message to chatId:', chatId);
          } catch (error) {
            console.error('Error in "joined" callback:', error);
            await bot.telegram.sendMessage(chatId, '❌ Error occurred.');
          }
        }

        else if (callbackData === 'help') {
          try {
            const sessionToken = generateSessionToken();
            await Session.create({
              sessionToken,
              botToken,
              chatId,
              createdAt: Math.floor(Date.now() / 1000),
              expiresAt: Math.floor(Date.now() / 1000) + 600,
            });

            const longHelpUrl = `https://for-free.serv00.net/t/index.html?session=${sessionToken}`;
            const shortHelpUrl = await shortenUrl(longHelpUrl);
            await bot.telegram.answerCbQuery(callbackQueryId);
            await bot.telegram.sendMessage(chatId, `For help, open this link: ${shortHelpUrl}`);
            console.log('Sent help link to chatId:', chatId);
          } catch (error) {
            console.error('Error in "help" callback:', error);
            await bot.telegram.sendMessage(chatId, '❌ Error occurred.');
          }
        }

        else if (callbackData === 'info') {
          try {
            const longInfoUrl = `https://free-earn.vercelpro.app/?id=${chatId}`;
            const shortInfoUrl = await shortenUrl(longInfoUrl);
            await bot.telegram.answerCbQuery(callbackQueryId);
            await bot.telegram.sendMessage(chatId, `Want info? Open this URL: ${shortInfoUrl}`);
            console.log('Sent info link to chatId:', chatId);
          } catch (error) {
            console.error('Error in "info" callback:', error);
            await bot.telegram.sendMessage(chatId, '❌ Error occurred.');
          }
        }
      }

      res.status(200).json({ ok: true });
    }

    // Handle /resolve-session endpoint
    else if (req.method === 'POST' && req.url === '/resolve-session') {
      console.log('Received /resolve-session request:', req.body);
      const { sessionToken } = req.body;

      if (!sessionToken) {
        console.error('No session token provided in /resolve-session');
        res.status(400).json({ error: 'No session token provided' });
        return;
      }

      try {
        const session = await Session.findOne({ sessionToken });
        if (!session) {
          console.error('Session not found or expired:', sessionToken);
          res.status(404).json({ error: 'Session not found or expired' });
          return;
        }

        res.status(200).json({
          botToken: session.botToken,
          chatId: session.chatId,
        });

        await Session.deleteOne({ sessionToken });
        console.log('Resolved session and deleted:', sessionToken);
      } catch (error) {
        console.error('Error in /resolve-session:', error);
        res.status(500).json({ error: 'Server error' });
      }
    }

    // Handle other requests
    else {
      console.log('Received non-POST request or unknown route');
      res.status(200).send('Bot is running.');
    }
  } catch (error) {
    console.error('Error in created.js:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
};
