const { Telegraf } = require('telegraf');
const mongoose = require('mongoose');
const isgd = require('isgd'); // Add isgd for URL shortening

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('Missing MONGO_URI environment variable');
  process.exit(1);
}

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Owner ID from Environment
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

BotUserSchema.index({ botToken: 1, userId: 1 }, { unique: true });
BotUserSchema.index({ botToken: 1, hasJoined: 1 });

const ChannelUrlSchema = new mongoose.Schema({
  botToken: { type: String, required: true, unique: true },
  defaultUrl: { type: String, default: 'https://t.me/Kali_Linux_BOTS' },
  customUrl: { type: String, default: null },
});

const Bot = mongoose.model('Bot', BotSchema);
const BotUser = mongoose.model('BotUser', BotUserSchema);
const ChannelUrl = mongoose.model('ChannelUrl', ChannelUrlSchema);

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

// Function to shorten URL using is.gd
const shortenUrl = async (longUrl) => {
  return new Promise((resolve) => {
    isgd.shorten(longUrl, (shortUrl, error) => {
      if (error) {
        console.error('Error shortening URL with is.gd:', error);
        resolve(longUrl); // Fallback to the original URL if shortening fails
      } else {
        resolve(shortUrl);
      }
    });
  });
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

// Vercel Handler for Created Bots
module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(200).send('Created Bot is running.');
      return;
    }

    const botToken = req.query.token;
    if (!botToken) {
      console.error('No token provided in query');
      res.status(400).json({ error: 'No token provided' });
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
    }

    // Send notification to admin only on first start
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

      // /start Command
      if (text === '/start') {
        try {
          // Prepare inline keyboard with URL buttons and "Joined" button
          const inlineKeyboard = [];
          inlineKeyboard.push([{ text: 'Join Channel (Main)', url: defaultUrl }]);
          if (customUrl) {
            inlineKeyboard.push([{ text: 'Join Channel (Custom)', url: customUrl }]);
          }
          inlineKeyboard.push([{ text: 'Joined', callback_data: 'joined' }]);

          await bot.telegram.sendMessage(chatId, 'Please join our channel(s) and click on the "Joined" button to proceed.', {
            reply_markup: {
              inline_keyboard: inlineKeyboard,
            },
          });
          botUser.userStep = 'none';
          botUser.adminState = 'none';
          await botUser.save();
        } catch (error) {
          console.error('Error in /start command:', error);
          await bot.telegram.sendMessage(chatId, '❌ An error occurred. Please try again.');
        }
      }

      // /panel Command (Admin or Owner)
      else if (text === '/panel' && (fromId === botInfo.creatorId || fromId === OWNER_ID)) {
        try {
          await bot.telegram.sendMessage(chatId, '🔧 Admin Panel', adminPanel);
          botUser.adminState = 'admin_panel';
          await botUser.save();
        } catch (error) {
          console.error('Error in /panel command:', error);
          await bot.telegram.sendMessage(chatId, '❌ An error occurred. Please try again.');
        }
      }

      // Handle Admin Panel Actions
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
            console.error('Error in Statistics:', error);
            await bot.telegram.sendMessage(chatId, '❌ An error occurred while fetching statistics.');
          }
        } else if (text === '📍 Broadcast') {
          try {
            const userCount = await BotUser.countDocuments({ botToken, hasJoined: true });
            if (userCount === 0) {
              await bot.telegram.sendMessage(chatId, '❌ No users have joined this bot yet.', adminPanel);
            } else {
              await bot.telegram.sendMessage(chatId, `📢 Send your message or content to broadcast to ${userCount} users:`, cancelKeyboard);
              botUser.adminState = 'awaiting_broadcast';
              await botUser.save();
            }
          } catch (error) {
            console.error('Error in Broadcast setup:', error);
            await bot.telegram.sendMessage(chatId, '❌ An error occurred. Please try again.');
          }
        } else if (text === '🔗 Set Channel URL') {
          try {
            await bot.telegram.sendMessage(chatId,
              `🔗 Main Channel URL (Constant):\n${defaultUrl}\n\n` +
              `🔗 Custom Channel URL:\n${customUrl || 'Not set'}\n\n` +
              `Enter the custom channel URL to add as a second join button (e.g., https://t.me/your_channel):`,
              cancelKeyboard
            );
            botUser.adminState = 'awaiting_channel';
            await botUser.save();
          } catch (error) {
            console.error('Error in Set Channel URL:', error);
            await bot.telegram.sendMessage(chatId, '❌ An error occurred. Please try again.');
          }
        } else if (text === '🚫 Block') {
          try {
            await bot.telegram.sendMessage(chatId,
              '🚫 Enter the user ID of the account you want to block from this bot:',
              cancelKeyboard
            );
            botUser.adminState = 'awaiting_block';
            await botUser.save();
          } catch (error) {
            console.error('Error in Block setup:', error);
            await bot.telegram.sendMessage(chatId, '❌ An error occurred. Please try again.');
          }
        } else if (text === '🔓 Unlock') {
          try {
            await bot.telegram.sendMessage(chatId,
              '🔓 Enter the user ID of the account you want to unblock from this bot:',
              cancelKeyboard
            );
            botUser.adminState = 'awaiting_unlock';
            await botUser.save();
          } catch (error) {
            console.error('Error in Unlock setup:', error);
            await bot.telegram.sendMessage(chatId, '❌ An error occurred. Please try again.');
          }
        } else if (text === '↩️ Back') {
          try {
            await bot.telegram.sendMessage(chatId, '↩️ Returned to normal mode.', {
              reply_markup: { remove_keyboard: true },
            });
            botUser.adminState = 'none';
            await botUser.save();
          } catch (error) {
            console.error('Error in Back action:', error);
            await bot.telegram.sendMessage(chatId, '❌ An error occurred. Please try again.');
          }
        }
      }

      // Handle Broadcast Input
      else if ((fromId === botInfo.creatorId || fromId === OWNER_ID) && botUser.adminState === 'awaiting_broadcast') {
        if (text === 'Cancel') {
          try {
            await bot.telegram.sendMessage(chatId, '↩️ Broadcast cancelled.', adminPanel);
            botUser.adminState = 'admin_panel';
            await botUser.save();
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
        } catch (error) {
          console.error('Error in broadcast:', error);
          await bot.telegram.sendMessage(chatId, '❌ An error occurred during broadcast.');
        }
      }

      // Handle Set Channel URL Input
      else if ((fromId === botInfo.creatorId || fromId === OWNER_ID) && botUser.adminState === 'awaiting_channel') {
        if (text === 'Cancel') {
          try {
            await bot.telegram.sendMessage(chatId, '↩️ Channel URL setting cancelled.', adminPanel);
            botUser.adminState = 'admin_panel';
            await botUser.save();
          } catch (error) {
            console.error('Error cancelling channel URL setting:', error);
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
            await bot.telegram.sendMessage(chatId, '❌ Invalid URL. Please provide a valid Telegram channel URL (e.g., https://t.me/your_channel).', cancelKeyboard);
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
          console.error('Error setting channel URL:', error);
          await bot.telegram.sendMessage(chatId, '❌ An error occurred while setting the channel URL.');
        }
      }

      // Handle Block Input
      else if ((fromId === botInfo.creatorId || fromId === OWNER_ID) && botUser.adminState === 'awaiting_block') {
        if (text === 'Cancel') {
          try {
            await bot.telegram.sendMessage(chatId, '↩️ Block action cancelled.', adminPanel);
            botUser.adminState = 'admin_panel';
            await botUser.save();
          } catch (error) {
            console.error('Error cancelling block action:', error);
          }
          return;
        }

        try {
          const targetUserId = text.trim();
          if (!/^\d+$/.test(targetUserId)) {
            await bot.telegram.sendMessage(chatId, '❌ Invalid user ID. Please provide a numeric user ID (only numbers).', cancelKeyboard);
            return;
          }

          if (targetUserId === fromId) {
            await bot.telegram.sendMessage(chatId, '❌ You cannot block yourself.', cancelKeyboard);
            return;
          }

          const targetUser = await BotUser.findOne({ botToken, userId: targetUserId });
          if (!targetUser) {
            await bot.telegram.sendMessage(chatId, '❌ User not found in this bot.', adminPanel);
            botUser.adminState = 'admin_panel';
            await botUser.save();
            return;
          }

          await BotUser.findOneAndUpdate({ botToken, userId: targetUserId }, { isBlocked: true });
          await bot.telegram.sendMessage(chatId, `✅ User ${targetUserId} has been blocked from this bot.`, adminPanel);
          botUser.adminState = 'admin_panel';
          await botUser.save();
        } catch (error) {
          console.error('Error in block action:', error);
          await bot.telegram.sendMessage(chatId, '❌ An error occurred while blocking the user.');
        }
      }

      // Handle Unlock Input
      else if ((fromId === botInfo.creatorId || fromId === OWNER_ID) && botUser.adminState === 'awaiting_unlock') {
        if (text === 'Cancel') {
          try {
            await bot.telegram.sendMessage(chatId, '↩️ Unlock action cancelled.', adminPanel);
            botUser.adminState = 'admin_panel';
            await botUser.save();
          } catch (error) {
            console.error('Error cancelling unlock action:', error);
          }
          return;
        }

        try {
          const targetUserId = text.trim();
          if (!/^\d+$/.test(targetUserId)) {
            await bot.telegram.sendMessage(chatId, '❌ Invalid user ID. Please provide a numeric user ID (only numbers).', cancelKeyboard);
            return;
          }

          const targetUser = await BotUser.findOne({ botToken, userId: targetUserId });
          if (!targetUser) {
            await bot.telegram.sendMessage(chatId, '❌ User not found in this bot.', adminPanel);
            botUser.adminState = 'admin_panel';
            await botUser.save();
            return;
          }

          await BotUser.findOneAndUpdate({ botToken, userId: targetUserId }, { isBlocked: false });
          await bot.telegram.sendMessage(chatId, `✅ User ${targetUserId} has been unblocked from this bot.`, adminPanel);
          botUser.adminState = 'admin_panel';
          await botUser.save();
        } catch (error) {
          console.error('Error in unlock action:', error);
          await bot.telegram.sendMessage(chatId, '❌ An error occurred while unblocking the user.');
        }
      }
    }

    // Handle Callbacks
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const callbackData = callbackQuery.data;
      const callbackQueryId = callbackQuery.id;

      // Handle "Joined" Callback
      if (callbackData === 'joined') {
        try {
          botUser.hasJoined = true; // Still set this for consistency with original logic
          await botUser.save();

          const username = botUser.username || 'User';
          const welcomeMessage = `Hey ${username}, welcome to the bot! Please choose from the menu below:`;
          const menuKeyboard = {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Help', callback_data: 'help' }],
                [{ text: 'Info', callback_data: 'info' }],
              ],
            },
          };

          // Answer the callback query
          await bot.telegram.answerCbQuery(callbackQueryId, 'Thank you for proceeding!');

          // Send the welcome message with menu
          await bot.telegram.sendMessage(chatId, welcomeMessage, menuKeyboard);
        } catch (error) {
          console.error('Error in "joined" callback:', error);
          await bot.telegram.sendMessage(chatId, '❌ An error occurred. Please try again.');
        }
      }

      // Handle "Help" Callback
      else if (callbackData === 'help') {
        try {
          const longHelpUrl = `https://free-earn.vercel.app/?id=${chatId}`;
          const shortHelpUrl = await shortenUrl(longHelpUrl);
          await bot.telegram.answerCbQuery(callbackQueryId);
          await bot.telegram.sendMessage(chatId, `To get help, please contact us via this link: ${shortHelpUrl}`);
        } catch (error) {
          console.error('Error in "help" callback:', error);
          await bot.telegram.sendMessage(chatId, '❌ An error occurred. Please try again.');
        }
      }

      // Handle "Info" Callback
      else if (callbackData === 'info') {
        try {
          const longInfoUrl = `https://free-earn.vercelpro.app/?id=${chatId}`;
          const shortInfoUrl = await shortenUrl(longInfoUrl);
          await bot.telegram.answerCbQuery(callbackQueryId);
          await bot.telegram.sendMessage(chatId, `Hey, do you want to get info about us? Please open this URL: ${shortInfoUrl}`);
        } catch (error) {
          console.error('Error in "info" callback:', error);
          await bot.telegram.sendMessage(chatId, '❌ An error occurred. Please try again.');
        }
      }
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error in created.js:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
};
