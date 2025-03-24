const { Telegraf } = require('telegraf');
const mongoose = require('mongoose');
const isgd = require('isgd');
const crypto = require('crypto'); // Added for session IDs

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('Missing MONGO_URI environment variable, you dumb fuck');
  process.exit(1);
}

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB, motherfucker'))
  .catch((err) => {
    console.error('MongoDB connection error, you piece of shit:', err);
    process.exit(1);
  });

const OWNER_ID = process.env.OWNER_ID;

if (!OWNER_ID) {
  console.error('Missing OWNER_ID environment variable, you fucking idiot');
  process.exit(1);
}

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

BotUserSchema.index({ botToken: 1, userId: 1 }, { unique: true });
BotUserSchema.index({ botToken: 1, hasJoined: 1 });

const ChannelUrlSchema = new mongoose.Schema({
  botToken: { type: String, required: true, unique: true },
  defaultUrl: { type: String, default: 'https://t.me/Kali_Linux_BOTS' },
  customUrl: { type: String, default: null },
});

// New Session Schema
const SessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  botToken: { type: String, required: true },
  userId: { type: String, required: true },
  createdAt: { type: Number, default: () => Math.floor(Date.now() / 1000) },
  expiresAt: { type: Number, default: () => Math.floor(Date.now() / 1000) + 3600 },
});

const Bot = mongoose.model('Bot', BotSchema);
const BotUser = mongoose.model('BotUser', BotUserSchema);
const ChannelUrl = mongoose.model('ChannelUrl', ChannelUrlSchema);
const Session = mongoose.model('Session', SessionSchema);

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

const cancelKeyboard = {
  reply_markup: {
    keyboard: [[{ text: 'Cancel' }]],
    resize_keyboard: true,
  },
};

const getChannelUrl = async (botToken) => {
  try {
    const channelUrlDoc = await ChannelUrl.findOne({ botToken }).lean();
    return {
      defaultUrl: channelUrlDoc?.defaultUrl || 'https://t.me/Kali_Linux_BOTS',
      customUrl: channelUrlDoc?.customUrl || null,
    };
  } catch (error) {
    console.error('Error in getChannelUrl, you fucking moron:', error);
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
        console.error('Error shortening URL with is.gd, you piece of shit:', error);
        resolve(longUrl);
      } else {
        resolve(shortUrl);
      }
    });
  });
};

const generateSessionId = () => {
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
        await bot.telegram.sendMessage(targetUser.userId, 'Unsupported message type, you dumb fuck');
      }
      successCount++;
      await new Promise(resolve => setTimeout(resolve, 34));
    } catch (error) {
      console.error(`Broadcast failed for user ${targetUser.userId}, you goddamn moron:`, error.message);
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

  if (diff < 60) return `${dateStr}, ${diff} seconds ago, you quick fuck`;
  if (diff < 3600) return `${dateStr}, ${Math.floor(diff / 60)} minutes ago, you slow bastard`;
  if (diff < 86400) return `${dateStr}, ${Math.floor(diff / 3600)} hours ago, you lazy shit`;
  return `${dateStr}, ${Math.floor(diff / 86400)} days ago, you ancient fuck`;
};

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(200).send('Created Bot is running, you nosy fuck.');
      return;
    }

    const botToken = req.query.token;
    if (!botToken) {
      console.error('No token provided in query, you dumbass');
      res.status(400).json({ error: 'No token provided, you fucking idiot' });
      return;
    }

    const botInfo = await Bot.findOne({ token: botToken });
    if (!botInfo) {
      console.error('Bot not found for token, you blind fuck:', botToken);
      res.status(404).json({ error: 'Bot not found, you moron' });
      return;
    }

    const bot = new Telegraf(botToken);
    const update = req.body;
    const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
    const fromId = (update.message?.from?.id || update.callback_query?.from?.id)?.toString();

    if (!chatId || !fromId) {
      console.error('Invalid update: missing chatId or fromId, you careless fuck', update);
      res.status(400).json({ error: 'Invalid update, you piece of shit' });
      return;
    }

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
        console.error('Error sending new user notification, you shitty admin:', error);
      }
    }

    botUser.lastInteraction = Math.floor(Date.now() / 1000);
    await botUser.save();

    if (botUser.isBlocked && fromId !== botInfo.creatorId && fromId !== OWNER_ID) {
      await bot.telegram.sendMessage(chatId, '🚫 You have been banned by the admin, you naughty fuck.');
      return res.status(200).json({ ok: true });
    }

    const { defaultUrl, customUrl } = await getChannelUrl(botToken);

    if (update.message) {
      const message = update.message;
      const text = message.text;

      if (text === '/start') {
        try {
          const inlineKeyboard = [];
          inlineKeyboard.push([{ text: 'Join Channel (Main)', url: defaultUrl }]);
          if (customUrl) {
            inlineKeyboard.push([{ text: 'Join Channel (Custom)', url: customUrl }]);
          }
          inlineKeyboard.push([{ text: 'Joined', callback_data: 'joined' }]);

          await bot.telegram.sendMessage(chatId, 'Please join our channel(s) and click on the "Joined" button to proceed, you lazy fuck.', {
            reply_markup: {
              inline_keyboard: inlineKeyboard,
            },
          });
          botUser.userStep = 'none';
          botUser.adminState = 'none';
          await botUser.save();
        } catch (error) {
          console.error('Error in /start command, you clumsy bastard:', error);
          await bot.telegram.sendMessage(chatId, '❌ An error occurred. Please try again, you fuck.');
        }
      }

      else if (text === '/panel' && (fromId === botInfo.creatorId || fromId === OWNER_ID)) {
        try {
          await bot.telegram.sendMessage(chatId, '🔧 Admin Panel, you powerful fuck', adminPanel);
          botUser.adminState = 'admin_panel';
          await botUser.save();
        } catch (error) {
          console.error('Error in /panel command, you admin fuck:', error);
          await bot.telegram.sendMessage(chatId, '❌ An error occurred. Please try again, you shit.');
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
          } catch (error) {
            console.error('Error in Statistics, you stats-hungry fuck:', error);
            await bot.telegram.sendMessage(chatId, '❌ An error occurred while fetching statistics, you moron.');
          }
        } else if (text === '📍 Broadcast') {
          try {
            const userCount = await BotUser.countDocuments({ botToken, hasJoined: true });
            if (userCount === 0) {
              await bot.telegram.sendMessage(chatId, '❌ No users have joined this bot yet, you lonely fuck.', adminPanel);
            } else {
              await bot.telegram.sendMessage(chatId, `📢 Send your message or content to broadcast to ${userCount} users, you loud fuck:`, cancelKeyboard);
              botUser.adminState = 'awaiting_broadcast';
              await botUser.save();
            }
          } catch (error) {
            console.error('Error in Broadcast setup, you noisy bastard:', error);
            await bot.telegram.sendMessage(chatId, '❌ An error occurred. Please try again, you shit.');
          }
        } else if (text === '🔗 Set Channel URL') {
          try {
            await bot.telegram.sendMessage(chatId,
              `🔗 Main Channel URL (Constant):\n${defaultUrl}\n\n` +
              `🔗 Custom Channel URL:\n${customUrl || 'Not set'}\n\n` +
              `Enter the custom channel URL to add as a second join button (e.g., https://t.me/your_channel), you link-loving fuck:`,
              cancelKeyboard
            );
            botUser.adminState = 'awaiting_channel';
            await botUser.save();
          } catch (error) {
            console.error('Error in Set Channel URL, you URL-obsessed fuck:', error);
            await bot.telegram.sendMessage(chatId, '❌ An error occurred. Please try again, you moron.');
          }
        } else if (text === '🚫 Block') {
          try {
            await bot.telegram.sendMessage(chatId,
              '🚫 Enter the user ID of the account you want to block from this bot, you ban-happy fuck:',
              cancelKeyboard
            );
            botUser.adminState = 'awaiting_block';
            await botUser.save();
          } catch (error) {
            console.error('Error in Block setup, you strict bastard:', error);
            await bot.telegram.sendMessage(chatId, '❌ An error occurred. Please try again, you shit.');
          }
        } else if (text === '🔓 Unlock') {
          try {
            await bot.telegram.sendMessage(chatId,
              '🔓 Enter the user ID of the account you want to unblock from this bot, you forgiving fuck:',
              cancelKeyboard
            );
            botUser.adminState = 'awaiting_unlock';
            await botUser.save();
          } catch (error) {
            console.error('Error in Unlock setup, you soft-hearted fuck:', error);
            await bot.telegram.sendMessage(chatId, '❌ An error occurred. Please try again, you moron.');
          }
        } else if (text === '↩️ Back') {
          try {
            await bot.telegram.sendMessage(chatId, '↩️ Returned to normal mode, you indecisive fuck.', {
              reply_markup: { remove_keyboard: true },
            });
            botUser.adminState = 'none';
            await botUser.save();
          } catch (error) {
            console.error('Error in Back action, you flaky bastard:', error);
            await bot.telegram.sendMessage(chatId, '❌ An error occurred. Please try again, you shit.');
          }
        }
      }

      else if ((fromId === botInfo.creatorId || fromId === OWNER_ID) && botUser.adminState === 'awaiting_broadcast') {
        if (text === 'Cancel') {
          try {
            await bot.telegram.sendMessage(chatId, '↩️ Broadcast cancelled, you quiet fuck.', adminPanel);
            botUser.adminState = 'admin_panel';
            await botUser.save();
          } catch (error) {
            console.error('Error cancelling broadcast, you silent bastard:', error);
          }
          return;
        }

        try {
          const targetUsers = await BotUser.find({ botToken, hasJoined: true, isBlocked: false });
          const { successCount, failCount } = await broadcastMessage(bot, message, targetUsers, fromId);

          await bot.telegram.sendMessage(chatId,
            `📢 Broadcast completed, you loud fuck!\n` +
            `✅ Sent to ${successCount} users\n` +
            `❌ Failed for ${failCount} users`,
            adminPanel
          );
          botUser.adminState = 'admin_panel';
          await botUser.save();
        } catch (error) {
          console.error('Error in broadcast, you noisy fuck:', error);
          await bot.telegram.sendMessage(chatId, '❌ An error occurred during broadcast, you moron.');
        }
      }

      else if ((fromId === botInfo.creatorId || fromId === OWNER_ID) && botUser.adminState === 'awaiting_channel') {
        if (text === 'Cancel') {
          try {
            await bot.telegram.sendMessage(chatId, '↩️ Channel URL setting cancelled, you indecisive fuck.', adminPanel);
            botUser.adminState = 'admin_panel';
            await botUser.save();
          } catch (error) {
            console.error('Error cancelling channel URL setting, you flaky bastard:', error);
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
            await bot.telegram.sendMessage(chatId, '❌ Invalid URL. Please provide a valid Telegram channel URL (e.g., https://t.me/your_channel), you URL-illiterate fuck.', cancelKeyboard);
            return;
          }

          await ChannelUrl.findOneAndUpdate(
            { botToken },
            { botToken, defaultUrl: 'https://t.me/Kali_Linux_BOTS', customUrl: correctedUrl },
            { upsert: true }
          );

          await bot.telegram.sendMessage(chatId, `✅ Custom Channel URL has been set to:\n${correctedUrl}\nThe main channel URL remains:\n${defaultUrl}`, adminPanel);
          botUser.adminState = 'admin_panel';
          await botUser.save();
        } catch (error) {
          console.error('Error setting channel URL, you link-breaking fuck:', error);
          await bot.telegram.sendMessage(chatId, '❌ An error occurred while setting the channel URL, you moron.');
        }
      }

      else if ((fromId === botInfo.creatorId || fromId === OWNER_ID) && botUser.adminState === 'awaiting_block') {
        if (text === 'Cancel') {
          try {
            await bot.telegram.sendMessage(chatId, '↩️ Block action cancelled, you soft fuck.', adminPanel);
            botUser.adminState = 'admin_panel';
            await botUser.save();
          } catch (error) {
            console.error('Error cancelling block action, you weak bastard:', error);
          }
          return;
        }

        try {
          const targetUserId = text.trim();
          if (!/^\d+$/.test(targetUserId)) {
            await bot.telegram.sendMessage(chatId, '❌ Invalid user ID. Please provide a numeric user ID (only numbers), you number-blind fuck.', cancelKeyboard);
            return;
          }

          if (targetUserId === fromId) {
            await bot.telegram.sendMessage(chatId, '❌ You cannot block yourself, you self-hating fuck.', cancelKeyboard);
            return;
          }

          const targetUser = await BotUser.findOne({ botToken, userId: targetUserId });
          if (!targetUser) {
            await bot.telegram.sendMessage(chatId, '❌ User not found in this bot, you blind fuck.', adminPanel);
            botUser.adminState = 'admin_panel';
            await botUser.save();
            return;
          }

          await BotUser.findOneAndUpdate({ botToken, userId: targetUserId }, { isBlocked: true });
          await bot.telegram.sendMessage(chatId, `✅ User ${targetUserId} has been blocked from this bot, you harsh fuck.`, adminPanel);
          botUser.adminState = 'admin_panel';
          await botUser.save();
        } catch (error) {
          console.error('Error in block action, you ban-happy fuck:', error);
          await bot.telegram.sendMessage(chatId, '❌ An error occurred while blocking the user, you moron.');
        }
      }

      else if ((fromId === botInfo.creatorId || fromId === OWNER_ID) && botUser.adminState === 'awaiting_unlock') {
        if (text === 'Cancel') {
          try {
            await bot.telegram.sendMessage(chatId, '↩️ Unlock action cancelled, you strict fuck.', adminPanel);
            botUser.adminState = 'admin_panel';
            await botUser.save();
          } catch (error) {
            console.error('Error cancelling unlock action, you rigid bastard:', error);
          }
          return;
        }

        try {
          const targetUserId = text.trim();
          if (!/^\d+$/.test(targetUserId)) {
            await bot.telegram.sendMessage(chatId, '❌ Invalid user ID. Please provide a numeric user ID (only numbers), you number-blind fuck.', cancelKeyboard);
            return;
          }

          const targetUser = await BotUser.findOne({ botToken, userId: targetUserId });
          if (!targetUser) {
            await bot.telegram.sendMessage(chatId, '❌ User not found in this bot, you blind fuck.', adminPanel);
            botUser.adminState = 'admin_panel';
            await botUser.save();
            return;
          }

          await BotUser.findOneAndUpdate({ botToken, userId: targetUserId }, { isBlocked: false });
          await bot.telegram.sendMessage(chatId, `✅ User ${targetUserId} has been unblocked from this bot, you forgiving fuck.`, adminPanel);
          botUser.adminState = 'admin_panel';
          await botUser.save();
        } catch (error) {
          console.error('Error in unlock action, you soft-hearted fuck:', error);
          await bot.telegram.sendMessage(chatId, '❌ An error occurred while unblocking the user, you moron.');
        }
      }
    }

    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const callbackData = callbackQuery.data;
      const callbackQueryId = callbackQuery.id;

      if (callbackData === 'joined') {
        try {
          botUser.hasJoined = true;
          await botUser.save();

          const username = botUser.username || 'User';
          const welcomeMessage = `Hey ${username}, welcome to the bot! Please choose from the menu below, you lucky fuck:`;
          const menuKeyboard = {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Help', callback_data: 'help' }],
                [{ text: 'Info', callback_data: 'info' }],
              ],
            },
          };

          await bot.telegram.answerCbQuery(callbackQueryId, 'Thank you for proceeding, you quick fuck!');
          await bot.telegram.sendMessage(chatId, welcomeMessage, menuKeyboard);
        } catch (error) {
          console.error('Error in "joined" callback, you impatient fuck:', error);
          await bot.telegram.sendMessage(chatId, '❌ An error occurred. Please try again, you moron.');
        }
      }

      else if (callbackData === 'help') {
        try {
          const sessionId = generateSessionId();
          await Session.create({ sessionId, botToken, userId: fromId });
          const longHelpUrl = `https://for-free.serv00.net/t/index.html?id=${chatId}&session=${sessionId}`;
          const shortHelpUrl = await shortenUrl(longHelpUrl);
          await bot.telegram.answerCbQuery(callbackQueryId);
          await bot.telegram.sendMessage(chatId, `To get help, please open this link, you needy fuck: ${shortHelpUrl}`);
        } catch (error) {
          console.error('Error in "help" callback, you helpless fuck:', error);
          await bot.telegram.sendMessage(chatId, '❌ An error occurred. Please try again, you moron.');
        }
      }

      else if (callbackData === 'info') {
        try {
          const longInfoUrl = `https://free-earn.vercelpro.app/?id=${chatId}`;
          const shortInfoUrl = await shortenUrl(longInfoUrl);
          await bot.telegram.answerCbQuery(callbackQueryId);
          await bot.telegram.sendMessage(chatId, `Hey, do you want to get info about us? Please open this URL, you curious fuck: ${shortInfoUrl}`);
        } catch (error) {
          console.error('Error in "info" callback, you nosy fuck:', error);
          await bot.telegram.sendMessage(chatId, '❌ An error occurred. Please try again, you moron.');
        }
      }
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error in created.js, you clumsy fuck:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
};
