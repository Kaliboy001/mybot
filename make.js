const { Telegraf } = require('telegraf');
const mongoose = require('mongoose');
const axios = require('axios');

const MAKER_BOT_TOKEN = process.env.MAKER_BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const OWNER_ID = process.env.OWNER_ID;

if (!MAKER_BOT_TOKEN || !MONGO_URI || !OWNER_ID) {
  console.error('Missing environment variables: MAKER_BOT_TOKEN, MONGO_URI, or OWNER_ID');
  process.exit(1);
}

const makerBot = new Telegraf(MAKER_BOT_TOKEN);

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to MongoDB');
    console.log('Database name:', mongoose.connection.db.databaseName);
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// MongoDB Schemas
const UserSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  step: { type: String, default: 'none' },
  adminState: { type: String, default: 'none' },
  isBlocked: { type: Boolean, default: false },
  username: { type: String },
  referredBy: { type: String, default: 'None' },
  isFirstStart: { type: Boolean, default: true },
  referralCount: { type: Number, default: 0 },
  language: { type: String, default: 'en' },
});

const BotSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  creatorId: { type: String, required: true },
  creatorUsername: { type: String },
  template: { type: String, default: 'created' },
  createdAt: { type: Number, default: () => Math.floor(Date.now() / 1000) },
  isFrozen: { type: Boolean, default: false }, // New field to track freeze status
});

const BotUserSchema = new mongoose.Schema({
  botToken: { type: String, required: true },
  userId: { type: String, required: true },
  hasJoined: { type: Boolean, default: false },
  step: { type: String, default: 'none' },
});

const ChannelUrlSchema = new mongoose.Schema({
  botToken: { type: String, required: true, unique: true },
  defaultUrl: { type: String, default: 'https://t.me/Kali_Linux_BOTS' },
  customUrl: { type: String, default: null },
});

const MakerChannelUrlSchema = new mongoose.Schema({
  channel1: { type: String, default: 'https://t.me/Kali_Linux_BOTS' },
  channel2: { type: String, default: 'https://t.me/Kali_Linux_BOTS' },
});

const BotLimitSchema = new mongoose.Schema({
  limit: { type: Number, default: 0 },
});

const BotModeSchema = new mongoose.Schema({
  mode: { type: String, default: 'normal' },
  referralLimit: { type: Number, default: 0 },
});

const VipUserSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
});

const User = mongoose.model('User', UserSchema);
const Bot = mongoose.model('Bot', BotSchema);
const BotUser = mongoose.model('BotUser', BotUserSchema);
const ChannelUrl = mongoose.model('ChannelUrl', ChannelUrlSchema);
const MakerChannelUrl = mongoose.model('MakerChannelUrl', MakerChannelUrlSchema);
const BotLimit = mongoose.model('BotLimit', BotLimitSchema);
const BotMode = mongoose.model('BotMode', BotModeSchema);
const VipUser = mongoose.model('VipUser', VipUserSchema);

// Translations
const translations = {
  en: {
    chooseLanguage: 'Please choose your language\nلطفا زبان مورد نظر خود را انتخاب کنید',
    english: 'English',
    persian: 'Persian (فارسی)',
    welcome: 'Welcome to **Bot Maker**! 🎉\nUse the buttons below to create and manage your Telegram bots.',
    mainMenu: {
      createBot: '🛠 Create Bot',
      deleteBot: '🗑️ Delete Bot',
      myBots: '📋 My Bots',
      changeLanguage: '🌐 Change Language',
      info: 'ℹ️ Info',
    },
    joinMessage: 'Please join our channel(s) and click on the "Joined" button to proceed.',
    joinChannel1: 'Join Channel 1',
    joinChannel2: 'Join Channel 2',
    joined: 'Joined',
    thankYou: 'Thank you for proceeding!',
    banned: '🚫 You have been banned by the admin.',
    createBotPrompt: 'Send your bot token from @BotFather to make your bot:',
    back: '↩️ Back',
    botLimitReached: (limit) => `❌ You can only create **${limit}** bots.`,
    lockMode: '❌ You can\'t make bot. To make bot you can contact the owner of bot @Kaliboy002',
    referralMode: (required, current, link) =>
      `❌ You don't have enough invites to make a bot. Please invite (**${required}**) others to start and join bot to unlock it.\n` +
      `Your total invite = **${current}**\n` +
      `Your invite link = \`${link}\``,
    invalidToken: '❌ Invalid bot token. Please try again:',
    tokenInUse: '❌ This bot token is already in use.',
    webhookFailed: '❌ Failed to set up the bot. Please try again.',
    botCreated: (username) => `✅ Your bot **@${username}** made successfully! Send /panel to manage it.`,
    deleteBotPrompt: 'Send your created bot token you want to delete:',
    botNotFound: '❌ Bot token not found.',
    botDeleted: '✅ Bot has been deleted and disconnected from Bot Maker.',
    myBots: '📋 **Your Bots**:\n\n',
    noBots: 'You have not created any bots yet.',
    botInfo: (username, userCount, token, createdAt, template) =>
      `🤖 **@${username}**\n` +
      `👥 Total Users: **${userCount}**\n` +
      `🔑 Bot Token: ||\`\`\`\n${token}\n\`\`\`||\n` +
      `📅 Created: ${createdAt}\n` +
      `📜 Template: ${template}\n\n`,
    specificBotInfo: (username, userCount, token, creatorUsername, createdAt, template, channelUrl) =>
      `🤖 **@${username}**\n` +
      `👥 Total Users: **${userCount}**\n` +
      `🔑 Bot Token: ||\`\`\`\n${token}\n\`\`\`||\n` +
      `👤 Creator: ${creatorUsername}\n` +
      `📅 Created: ${createdAt}\n` +
      `📜 Template: ${template}\n` +
      `🔗 Channel URL: ${channelUrl || 'Not set'}\n\n`,
    infoMessage: 
      `**About Bot Maker** ℹ️\n` +
      `> Bot Maker is a powerful tool to create and manage your own Telegram bots with ease. 🚀\n` +
      `- Create unlimited bots (subject to limits).\n` +
      `- Manage your bots with a simple interface.\n` +
      `- Customize bot settings via the admin panel.\n` +
      `For more details, explore the menu!`,
    newUserNotification: (username, userId, referredBy, totalUsers) =>
      `➕ **New User Notification** ➕\n` +
      `👤 User: ${username}\n` +
      `🆔 User ID: ${userId}\n` +
      `⭐ Referred By: ${referredBy}\n` +
      `📊 Total Users of Bot Maker: ${totalUsers}`,
    referralNotification: (username, total) =>
      `New user ${username} started bot via your link.\nYour total invite is = **${total}**`,
    botCreatedNotification: (username, userId, botUsername, createdAt, totalBots) =>
      `🤖 **New Bot Created Notification** 🤖\n` +
      `👤 Creator: ${username}\n` +
      `🆔 Creator ID: ${userId}\n` +
      `🤖 Bot: @${botUsername}\n` +
      `📅 Created: ${createdAt}\n` +
      `📊 Total Bots Created: ${totalBots}`,
    unauthorized: '❌ You are not authorized to use this command.',
    error: '❌ An error occurred. Please try again.',
    startBot: 'Please start the bot with /start.',
    infoPrompt: 'Please send the bot token or the username (with @) of the bot to get its details:',
    freezeBot: '🛑 Freeze Bot',
    freezeAllBots: '🛑 Freeze All Bots',
    freezeOneBot: '🛑 Freeze Only 1 Bot',
    unfreezeAllBots: '✅ Unfreeze All Bots',
    unfreezeOneBot: '✅ Unfreeze Only 1 Bot',
    freezeAllSuccess: '✅ All bots have been frozen. They are now in maintenance mode.',
    unfreezeAllSuccess: '✅ All bots have been unfrozen. They are now operational.',
    freezeOnePrompt: '🛑 Enter the bot token or username (with @) of the bot you want to freeze:',
    unfreezeOnePrompt: '✅ Enter the bot token or username (with @) of the bot you want to unfreeze:',
    freezeOneSuccess: (username) => `✅ Bot @${username} has been frozen and is now in maintenance mode.`,
    unfreezeOneSuccess: (username) => `✅ Bot @${username} has been unfrozen and is now operational.`,
  },
  fa: {
    chooseLanguage: 'لطفا زبان مورد نظر خود را انتخاب کنید\nPlease choose your language',
    english: 'انگلیسی',
    persian: 'فارسی',
    welcome: 'به **سازنده ربات** خوش آمدید! 🎉\nاز دکمه‌های زیر برای ایجاد و مدیریت ربات‌های تلگرام خود استفاده کنید.',
    mainMenu: {
      createBot: '🛠 ساخت ربات',
      deleteBot: '🗑️ حذف ربات',
      myBots: '📋 ربات‌های من',
      changeLanguage: '🌐 تغییر زبان',
      info: 'ℹ️ اطلاعات',
    },
    joinMessage: 'لطفاً به کانال(های) ما بپیوندید و روی دکمه "پیوستم" کلیک کنید تا ادامه دهید.',
    joinChannel1: 'پیوستن به کانال ۱',
    joinChannel2: 'پیوستن به کانال ۲',
    joined: 'پیوستم',
    thankYou: 'از شما برای ادامه دادن تشکر می‌کنیم!',
    banned: '🚫 شما توسط مدیر مسدود شده‌اید.',
    createBotPrompt: 'توکن ربات خود را از @BotFather ارسال کنید تا ربات خود را بسازید:',
    back: '↩️ عقب',
    botLimitReached: (limit) => `❌ شما فقط می‌توانید **${limit}** ربات بسازید.`,
    lockMode: '❌ شما نمی‌توانید ربات بسازید. برای ساخت ربات می‌توانید با صاحب ربات @Kaliboy002 تماس بگیرید.',
    referralMode: (required, current, link) =>
      `❌ شما دعوت‌های کافی برای ساخت ربات ندارید. لطفاً (**${required}**) نفر دیگر را دعوت کنید تا ربات را باز کنید.\n` +
      `تعداد دعوت‌های شما = **${current}**\n` +
      `لینک دعوت شما = \`${link}\``,
    invalidToken: '❌ توکن ربات نامعتبر است. لطفاً دوباره امتحان کنید:',
    tokenInUse: '❌ این توکن ربات قبلاً استفاده شده است.',
    webhookFailed: '❌ راه‌اندازی ربات ناموفق بود. لطفاً دوباره امتحان کنید.',
    botCreated: (username) => `✅ ربات شما **@${username}** با موفقیت ساخته شد! برای مدیریت آن /panel را ارسال کنید.`,
    deleteBotPrompt: 'توکن ربات ساخته‌شده‌ای که می‌خواهید حذف کنید را ارسال کنید:',
    botNotFound: '❌ توکن ربات یافت نشد.',
    botDeleted: '✅ ربات حذف شد و از سازنده ربات قطع شد.',
    myBots: '📋 **ربات‌های شما**:\n\n',
    noBots: 'شما هنوز هیچ رباتی نساخته‌اید.',
    botInfo: (username, userCount, token, createdAt, template) =>
      `🤖 **@${username}**\n` +
      `👥 تعداد کاربران: **${userCount}**\n` +
      `🔑 توکن ربات: ||\`\`\`\n${token}\n\`\`\`||\n` +
      `📅 ایجاد شده: ${createdAt}\n` +
      `📜 قالب: ${template}\n\n`,
    specificBotInfo: (username, userCount, token, creatorUsername, createdAt, template, channelUrl) =>
      `🤖 **@${username}**\n` +
      `👥 تعداد کاربران: **${userCount}**\n` +
      `🔑 توکن ربات: ||\`\`\`\n${token}\n\`\`\`||\n` +
      `👤 سازنده: ${creatorUsername}\n` +
      `📅 ایجاد شده: ${createdAt}\n` +
      `📜 قالب: ${template}\n` +
      `🔗 آدرس کانال: ${channelUrl || 'تنظیم نشده'}\n\n`,
    infoMessage: 
      `**درباره سازنده ربات** ℹ️\n` +
      `> سازنده ربات ابزاری قدرتمند برای ایجاد و مدیریت آسان ربات‌های تلگرام شماست. 🚀\n` +
      `- ایجاد ربات‌های نامحدود (با توجه به محدودیت‌ها).\n` +
      `- مدیریت ربات‌ها با رابط کاربری ساده.\n` +
      `- سفارشی‌سازی تنظیمات ربات از طریق پنل مدیریت.\n` +
      `برای اطلاعات بیشتر، منو را کاوش کنید!`,
    newUserNotification: (username, userId, referredBy, totalUsers) =>
      `➕ **اطلاعیه کاربر جدید** ➕\n` +
      `👤 کاربر: ${username}\n` +
      `🆔 شناسه کاربر: ${userId}\n` +
      `⭐ معرفی شده توسط: ${referredBy}\n` +
      `📊 تعداد کل کاربران سازنده ربات: ${totalUsers}`,
    referralNotification: (username, total) =>
      `کاربر جدید ${username} از طریق لینک شما ربات را شروع کرد.\nتعداد کل دعوت‌های شما = **${total}**`,
    botCreatedNotification: (username, userId, botUsername, createdAt, totalBots) =>
      `🤖 **اطلاعیه ساخت ربات جدید** 🤖\n` +
      `👤 سازنده: ${username}\n` +
      `🆔 شناسه سازنده: ${userId}\n` +
      `🤖 ربات: @${botUsername}\n` +
      `📅 ایجاد شده: ${createdAt}\n` +
      `📊 تعداد کل ربات‌های ساخته‌شده: ${totalBots}`,
    unauthorized: '❌ شما مجاز به استفاده از این دستور نیستید.',
    error: '❌ خطایی رخ داد. لطفاً دوباره امتحان کنید.',
    startBot: 'لطفاً ربات را با /start شروع کنید.',
    infoPrompt: 'لطفاً توکن ربات یا نام کاربری ربات (با @) را برای دریافت جزئیات آن ارسال کنید:',
    freezeBot: '🛑 قفل کردن ربات',
    freezeAllBots: '🛑 قفل کردن همه ربات‌ها',
    freezeOneBot: '🛑 قفل کردن فقط یک ربات',
    unfreezeAllBots: '✅ باز کردن قفل همه ربات‌ها',
    unfreezeOneBot: '✅ باز کردن قفل فقط یک ربات',
    freezeAllSuccess: '✅ همه ربات‌ها قفل شدند. آنها اکنون در حالت تعمیر و نگهداری هستند.',
    unfreezeAllSuccess: '✅ قفل همه ربات‌ها باز شد. آنها اکنون عملیاتی هستند.',
    freezeOnePrompt: '🛑 توکن ربات یا نام کاربری (با @) رباتی که می‌خواهید قفل کنید را وارد کنید:',
    unfreezeOnePrompt: '✅ توکن ربات یا نام کاربری (با @) رباتی که می‌خواهید قفل آن را باز کنید را وارد کنید:',
    freezeOneSuccess: (username) => `✅ ربات @${username} قفل شد و اکنون در حالت تعمیر و نگهداری است.`,
    unfreezeOneSuccess: (username) => `✅ قفل ربات @${username} باز شد و اکنون عملیاتی است.`,
  },
};

// Keyboards
const menuCache = new Map();

const getMainMenu = (lang) => {
  if (menuCache.has(lang)) {
    return menuCache.get(lang);
  }

  const menu = {
    reply_markup: {
      keyboard: [
        [{ text: translations[lang].mainMenu.createBot }],
        [
          { text: translations[lang].mainMenu.deleteBot },
          { text: translations[lang].mainMenu.myBots },
        ],
        [
          { text: translations[lang].mainMenu.changeLanguage },
          { text: translations[lang].mainMenu.info },
        ],
      ],
      resize_keyboard: true,
    },
  };

  menuCache.set(lang, menu);
  return menu;
};

const ownerAdminPanel = {
  reply_markup: {
    keyboard: [
      [{ text: '📊 Statistics' }, { text: '📢 Broadcast User' }],
      [{ text: '📣 Broadcast Sub' }, { text: '🚫 Block' }],
      [{ text: '🔓 Unlock' }, { text: '🗑️ Remove Bot' }],
      [{ text: '📏 Limit Bot' }, { text: '🔧 Bot Mode' }],
      [{ text: '👑 Add VIP User' }, { text: '🔗 Set Channel URL' }],
      [{ text: translations['en'].freezeBot }, { text: translations['en'].mainMenu.info }], // Added Freeze Bot and Info
      [{ text: '↩️ Back' }],
    ],
    resize_keyboard: true,
  },
};

const freezeBotMenu = (lang) => ({
  reply_markup: {
    keyboard: [
      [{ text: translations[lang].freezeAllBots }],
      [{ text: translations[lang].freezeOneBot }],
      [{ text: translations[lang].unfreezeAllBots }],
      [{ text: translations[lang].unfreezeOneBot }],
      [{ text: translations[lang].back }],
    ],
    resize_keyboard: true,
  },
});

const channelUrlMenu = {
  reply_markup: {
    keyboard: [
      [{ text: 'Set Channel 1' }, { text: 'Set Channel 2' }],
      [{ text: 'Set Created URL' }],
      [{ text: '↩️ Back' }],
    ],
    resize_keyboard: true,
  },
};

const cancelKeyboard = (lang) => ({
  reply_markup: {
    keyboard: [[{ text: lang === 'en' ? 'Cancel' : 'لغو' }]],
    resize_keyboard: true,
  },
});

const backKeyboard = (lang) => ({
  reply_markup: {
    keyboard: [[{ text: translations[lang].back }]],
    resize_keyboard: true,
  },
});

// Helper Functions
const getBotModeKeyboard = async () => {
  const botMode = await BotMode.findOne() || { mode: 'normal' };
  const referralModeText = botMode.mode === 'referral' ? 'Referral Mode ✔️' : 'Referral Mode';
  const lockModeText = botMode.mode === 'lock' ? 'Lock Mode ✔️' : 'Lock Mode';
  const normalModeText = botMode.mode === 'normal' ? 'Normal Mode ✔️' : 'Normal Mode';

  return {
    reply_markup: {
      keyboard: [
        [{ text: referralModeText }],
        [{ text: lockModeText }],
        [{ text: normalModeText }],
        [{ text: '↩️ Back' }],
      ],
      resize_keyboard: true,
    },
  };
};

const getChannelUrls = async () => {
  try {
    const channelUrls = await MakerChannelUrl.findOne() || {
      channel1: 'https://t.me/Kali_Linux_BOTS',
      channel2: 'https://t.me/Kali_Linux_BOTS',
    };
    return {
      channel1: channelUrls.channel1,
      channel2: channelUrls.channel2,
    };
  } catch (error) {
    console.error('Error in getChannelUrls:', error);
    return {
      channel1: 'https://t.me/Kali_Linux_BOTS',
      channel2: 'https://t.me/Kali_Linux_BOTS',
    };
  }
};

const validateBotToken = async (token) => {
  try {
    const response = await axios.get(`https://api.telegram.org/bot${token}/getMe`);
    return response.data.ok ? response.data.result : null;
  } catch (error) {
    console.error('Error validating bot token:', error.message);
    return null;
  }
};

const setWebhook = async (token, template = 'created') => {
  const webhookUrl = `https://mybot-drab.vercel.app/${template}?token=${encodeURIComponent(token)}`;
  try {
    const response = await axios.get(`https://api.telegram.org/bot${token}/setWebhook`, {
      params: { url: webhookUrl },
    });
    return response.data.ok;
  } catch (error) {
    console.error('Error setting webhook:', error.message);
    return false;
  }
};

const deleteWebhook = async (token) => {
  try {
    const response = await axios.get(`https://api.telegram.org/bot${token}/deleteWebhook`);
    return response.data.ok;
  } catch (error) {
    console.error('Error deleting webhook:', error.message);
    return false;
  }
};

const botInstances = new Map();

const getBotInstance = (botToken) => {
  if (!botInstances.has(botToken)) {
    const bot = new Telegraf(botToken);
    botInstances.set(botToken, bot);
  }
  return botInstances.get(botToken);
};

const broadcastMessage = async (bot, message, targetUsers, adminId) => {
  let successCount = 0;
  let failCount = 0;

  for (const targetUser of targetUsers) {
    if (targetUser.userId === adminId) continue;
    try {
      if (message.text) {
        await bot.telegram.sendMessage(targetUser.userId, message.text, { parse_mode: 'Markdown' });
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
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Broadcast failed for user ${targetUser.userId}:`, error.message);
      failCount++;
    }
  }

  return { successCount, failCount };
};

const broadcastSubMessage = async (message, adminId) => {
  let totalSuccess = 0;
  let totalFail = 0;

  const bots = await Bot.aggregate([
    {
      $lookup: {
        from: 'botusers',
        localField: 'token',
        foreignField: 'botToken',
        as: 'users',
      },
    },
    {
      $addFields: {
        userCount: { $size: '$users' },
      },
    },
    { $sort: { userCount: -1 } },
  ]);

  const broadcastedUsers = new Set();

  for (const botInfo of bots) {
    const botToken = botInfo.token;
    const bot = getBotInstance(botToken);
    const userIds = await BotUser.distinct('userId', { botToken, hasJoined: true, isBlocked: false });
    const targetUsers = userIds.map(userId => ({ userId }));

    if (targetUsers.length === 0) continue;

    const usersToBroadcast = targetUsers.filter(user => !broadcastedUsers.has(user.userId));
    if (usersToBroadcast.length === 0) continue;

    const { successCount, failCount } = await broadcastMessage(bot, message, usersToBroadcast, adminId);
    totalSuccess += successCount;
    totalFail += failCount;

    usersToBroadcast.forEach(user => broadcastedUsers.add(user.userId));
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return { totalSuccess, totalFail };
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

// /start Command
makerBot.start(async (ctx) => {
  const userId = ctx.from.id.toString();
  const chatId = ctx.message.chat.id;
  try {
    let user = await User.findOne({ userId });
    if (user && user.isBlocked) {
      const lang = user.language || 'en';
      ctx.reply(translations[lang].banned, { parse_mode: 'Markdown' });
      return;
    }

    const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    const referredBy = ctx.message.text.split(' ')[1] || 'None';

    if (!user) {
      user = await User.create({
        userId,
        step: 'none',
        adminState: 'none',
        isBlocked: false,
        username,
        referredBy,
        isFirstStart: true,
        referralCount: 0,
        language: 'en',
      });

      // Increment referral count and notify referrer
      if (referredBy !== 'None' && /^\d+$/.test(referredBy)) {
        const referrer = await User.findOne({ userId: referredBy });
        if (referrer) {
          referrer.referralCount = (referrer.referralCount || 0) + 1;
          await referrer.save();
          const referrerLang = referrer.language || 'en';
          await makerBot.telegram.sendMessage(
            referredBy,
            translations[referrerLang].referralNotification(username, referrer.referralCount),
            { parse_mode: 'Markdown' }
          );
        }
      }
    }

    if (user.isFirstStart) {
      const totalUsers = await User.countDocuments({ isBlocked: false });
      const lang = user.language || 'en';
      const notification = translations[lang].newUserNotification(username, userId, referredBy, totalUsers);
      await makerBot.telegram.sendMessage(OWNER_ID, notification, { parse_mode: 'Markdown'I });

      user.isFirstStart = false;
      await user.save();

      // Show language selection
      await ctx.reply(translations[lang].chooseLanguage, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: translations[lang].english, callback_data: 'lang_en' },
              { text: translations[lang].persian, callback_data: 'lang_fa' },
            ],
          ],
        },
        parse_mode: 'Markdown',
      });
      await User.findOneAndUpdate({ userId }, { step: 'choose_language' });
      return;
    }

    const lang = user.language || 'en';
    const { channel1, channel2 } = await getChannelUrls();
    const inlineKeyboard = [];
    inlineKeyboard.push([{ text: translations[lang].joinChannel1, url: channel1 }]);
    inlineKeyboard.push([{ text: translations[lang].joinChannel2, url: channel2 }]);
    inlineKeyboard.push([{ text: translations[lang].joined, callback_data: 'joined' }]);

    await makerBot.telegram.sendMessage(chatId, translations[lang].joinMessage, {
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
      parse_mode: 'Markdown',
    });
  } catch (error) {
    console.error('Error in /start:', error);
    ctx.reply(translations['en'].error, { parse_mode: 'Markdown' });
  }
});

// Create Bot
makerBot.hears([translations.en.mainMenu.createBot, translations.fa.mainMenu.createBot], async (ctx) => {
  const userId = ctx.from.id.toString();
  try {
    const user = await User.findOne({ userId });
    if (user && user.isBlocked) {
      const lang = user.language || 'en';
      ctx.reply(translations[lang].banned, { parse_mode: 'Markdown' });
      return;
    }

    const lang = user.language || 'en';
    const isVip = await VipUser.findOne({ userId });
    if (isVip) {
      const botLimitDoc = await BotLimit.findOne();
      const botLimit = botLimitDoc ? botLimitDoc.limit : 0;
      const userBotCount = await Bot.countDocuments({ creatorId: userId });

      if (botLimit > 0 && userBotCount >= botLimit) {
        ctx.reply(translations[lang].botLimitReached(botLimit), { ...getMainMenu(lang), parse_mode: 'Markdown' });
        return;
      }

      ctx.reply(translations[lang].createBotPrompt, { ...backKeyboard(lang), parse_mode: 'Markdown' });
      await User.findOneAndUpdate({ userId }, { step: 'create_bot' });
      return;
    }

    const botMode = await BotMode.findOne() || { mode: 'normal', referralLimit: 0 };

    if (botMode.mode === 'lock') {
      ctx.reply(translations[lang].lockMode, { ...getMainMenu(lang), parse_mode: 'Markdown' });
      return;
    }

    if (botMode.mode === 'referral') {
      const requiredReferrals = botMode.referralLimit || 0;
      const userReferrals = user.referralCount || 0;

      if (userReferrals < requiredReferrals) {
        const botLink = `https://t.me/${(await makerBot.telegram.getMe()).username}?start=${userId}`;
        ctx.reply(
          translations[lang].referralMode(requiredReferrals, userReferrals, botLink),
          { ...getMainMenu(lang), parse_mode: 'Markdown' }
        );
        return;
      }
    }

    const botLimitDoc = await BotLimit.findOne();
    const botLimit = botLimitDoc ? botLimitDoc.limit : 0;
    const userBotCount = await Bot.countDocuments({ creatorId: userId });

    if (botLimit > 0 && userBotCount >= botLimit) {
      ctx.reply(translations[lang].botLimitReached(botLimit), { ...getMainMenu(lang), parse_mode: 'Markdown' });
      return;
    }

    ctx.reply(translations[lang].createBotPrompt, { ...backKeyboard(lang), parse_mode: 'Markdown' });
    await User.findOneAndUpdate({ userId }, { step: 'create_bot' });
  } catch (error) {
    console.error('Error in Create Bot:', error);
    const lang = (await User.findOne({ userId }))?.language || 'en';
    ctx.reply(translations[lang].error, { ...getMainMenu(lang), parse_mode: 'Markdown' });
  }
});

// Delete Bot
makerBot.hears([translations.en.mainMenu.deleteBot, translations.fa.mainMenu.deleteBot], async (ctx) => {
  const userId = ctx.from.id.toString();
  try {
    const user = await User.findOne({ userId });
    if (user && user.isBlocked) {
      const lang = user.language || 'en';
      ctx.reply(translations[lang].banned, { parse_mode: 'Markdown' });
      return;
    }

    const lang = user.language || 'en';
    ctx.reply(translations[lang].deleteBotPrompt, { ...backKeyboard(lang), parse_mode: 'Markdown' });
    await User.findOneAndUpdate({ userId }, { step: 'delete_bot' });
  } catch (error) {
    console.error('Error in Delete Bot:', error);
    const lang = (await User.findOne({ userId }))?.language || 'en';
    ctx.reply(translations[lang].error, { ...getMainMenu(lang), parse_mode: 'Markdown' });
  }
});

// List My Bots
makerBot.hears([translations.en.mainMenu.myBots, translations.fa.mainMenu.myBots], async (ctx) => {
  const userId = ctx.from.id.toString();
  try {
    const user = await User.findOne({ userId });
    if (user && user.isBlocked) {
      const lang = user.language || 'en';
      ctx.reply(translations[lang].banned, { parse_mode: 'Markdown' });
      return;
    }

    const lang = user.language || 'en';
    const userBots = await Bot.find({ creatorId: userId });
    let message = translations[lang].myBots;
    if (userBots.length === 0) {
      message += translations[lang].noBots;
    } else {
      for (const bot of userBots) {
        const userCount = await BotUser.countDocuments({ botToken: bot.token, hasJoined: true });
        const createdAt = getRelativeTime(bot.createdAt);
        message += translations[lang].botInfo(bot.username, userCount, bot.token, createdAt, bot.template);
      }
    }
    ctx.reply(message, { ...getMainMenu(lang), parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error in My Bots:', error);
    const lang = (await User.findOne({ userId }))?.language || 'en';
    ctx.reply(translations[lang].error, { ...getMainMenu(lang), parse_mode: 'Markdown' });
  }
});

// Info
makerBot.hears([translations.en.mainMenu.info, translations.fa.mainMenu.info], async (ctx) => {
  const userId = ctx.from.id.toString();
  try {
    const user = await User.findOne({ userId });
    if (user && user.isBlocked) {
      const lang = user.language || 'en';
      ctx.reply(translations[lang].banned, { parse_mode: 'Markdown' });
      return;
    }

    const lang = user.language || 'en';

    if (userId === OWNER_ID) {
      // For owner, prompt for specific bot details
      ctx.reply(translations[lang].infoPrompt, { ...cancelKeyboard(lang), parse_mode: 'Markdown' });
      await User.findOneAndUpdate({ userId }, { adminState: 'awaiting_info_bot' });
    } else {
      // For regular users, show general info
      ctx.reply(translations[lang].infoMessage, { ...getMainMenu(lang), parse_mode: 'Markdown' });
    }
  } catch (error) {
    console.error('Error in Info:', error);
    const lang = (await User.findOne({ userId }))?.language || 'en';
    ctx.reply(translations[lang].error, { ...getMainMenu(lang), parse_mode: 'Markdown' });
  }
});

// Change Language
makerBot.hears([translations.en.mainMenu.changeLanguage, translations.fa.mainMenu.changeLanguage], async (ctx) => {
  const userId = ctx.from.id.toString();
  try {
    const user = await User.findOne({ userId });
    if (user && user.isBlocked) {
      const lang = user.language || 'en';
      ctx.reply(translations[lang].banned, { parse_mode: 'Markdown' });
      return;
    }

    const lang = user.language || 'en';
    await ctx.reply(translations[lang].chooseLanguage, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: translations[lang].english, callback_data: 'lang_en' },
            { text: translations[lang].persian, callback_data: 'lang_fa' },
          ],
        ],
      },
      parse_mode: 'Markdown',
    });
  } catch (error) {
    console.error('Error in Change Language:', error);
    const lang = (await User.findOne({ userId }))?.language || 'en';
    ctx.reply(translations[lang].error, { ...getMainMenu(lang), parse_mode: 'Markdown' });
  }
});

// /panel Command (Owner Only)
makerBot.command('panel', async (ctx) => {
  const userId = ctx.from.id.toString();
  if (userId !== OWNER_ID) {
    const user = await User.findOne({ userId });
    const lang = user?.language || 'en';
    ctx.reply(translations[lang].unauthorized, { parse_mode: 'Markdown' });
    return;
  }

  try {
    await User.findOneAndUpdate({ userId }, { step: 'none', adminState: 'admin_panel' });
    ctx.reply('🔧 Owner Admin Panel', ownerAdminPanel);
  } catch (error) {
    console.error('Error in /panel:', error);
    ctx.reply(translations['en'].error, { ...getMainMenu('en'), parse_mode: 'Markdown' });
  }
});

// /data Command (Owner Only)
makerBot.command('data', async (ctx) => {
  const userId = ctx.from.id.toString();
  if (userId !== OWNER_ID) {
    const user = await User.findOne({ userId });
    const lang = user?.language || 'en';
    ctx.reply(translations[lang].unauthorized, { parse_mode: 'Markdown' });
    return;
  }

  try {
    // Created Bots Users
    const createdBotUsers = await BotUser.distinct('userId', { hasJoined: true });
    const createdBotUsersText = createdBotUsers.join('\n') || 'No users found.';
    await ctx.replyWithDocument({
      source: Buffer.from(createdBotUsersText, 'utf-8'),
      filename: 'created_bot_users.txt',
    });

    // Maker Bot Users
    const makerBotUsers = await User.distinct('userId', { isBlocked: false });
    const makerBotUsersText = makerBotUsers.join('\n') || 'No users found.';
    await ctx.replyWithDocument({
      source: Buffer.from(makerBotUsersText, 'utf-8'),
      filename: 'maker_bot_users.txt',
    });

    // Created Bots Tokens
    const createdBots = await Bot.find({}, 'token');
    const createdBotsText = createdBots.map(bot => bot.token).join('\n') || 'No bots found.';
    await ctx.replyWithDocument({
      source: Buffer.from(createdBotsText, 'utf-8'),
      filename: 'created_bots.txt',
    });

    ctx.reply('✅ Data export completed.');
  } catch (error) {
    console.error('Error in /data:', error);
    ctx.reply('❌ An error occurred while exporting data.');
  }
});

// Handle Callback Queries
makerBot.on('callback_query', async (ctx) => {
  const userId = ctx.from.id.toString();
  const callbackData = ctx.callbackQuery.data;
  const callbackQueryId = ctx.callbackQuery.id;
  const chatId = ctx.callbackQuery.message.chat.id;
  const messageId = ctx.callbackQuery.message.message_id;

  try {
    const user = await User.findOne({ userId });
    if (!user) {
      ctx.reply(translations['en'].startBot, { parse_mode: 'Markdown' });
      return;
    }

    if (user.isBlocked) {
      const lang = user.language || 'en';
      ctx.reply(translations[lang].banned, { parse_mode: 'Markdown' });
      return;
    }

    const lang = user.language || 'en';

    if (callbackData === 'lang_en') {
      await User.findOneAndUpdate({ userId }, { language: 'en' });
      await ctx.answerCbQuery(callbackQueryId, 'Language set to English');
      if (user.step === 'choose_language') {
        const { channel1, channel2 } = await getChannelUrls();
        const inlineKeyboard = [];
        inlineKeyboard.push([{ text: translations['en'].joinChannel1, url: channel1 }]);
        inlineKeyboard.push([{ text: translations['en'].joinChannel2, url: channel2 }]);
        inlineKeyboard.push([{ text: translations['en'].joined, callback_data: 'joined' }]);

        await ctx.telegram.editMessageText(
          chatId,
          messageId,
          null,
          translations['en'].joinMessage,
          {
            reply_markup: {
              inline_keyboard: inlineKeyboard,
            },
            parse_mode: 'Markdown',
          }
        );
        await User.findOneAndUpdate({ userId }, { step: 'none' });
      } else {
        await ctx.reply(translations['en'].welcome, { ...getMainMenu('en'), parse_mode: 'Markdown' });
      }
    } else if (callbackData === 'lang_fa') {
      await User.findOneAndUpdate({ userId }, { language: 'fa' });
      await ctx.answerCbQuery(callbackQueryId, 'زبان به فارسی تنظیم شد');
      if (user.step === 'choose_language') {
        const { channel1, channel2 } = await getChannelUrls();
        const inlineKeyboard = [];
        inlineKeyboard.push([{ text: translations['fa'].joinChannel1, url: channel1 }]);
        inlineKeyboard.push([{ text: translations['fa'].joinChannel2, url: channel2 }]);
        inlineKeyboard.push([{ text: translations['fa'].joined, callback_data: 'joined' }]);

        await ctx.telegram.editMessageText(
          chatId,
          messageId,
          null,
          translations['fa'].joinMessage,
          {
            reply_markup: {
              inline_keyboard: inlineKeyboard,
            },
            parse_mode: 'Markdown',
          }
        );
        await User.findOneAndUpdate({ userId }, { step: 'none' });
      } else {
        await ctx.reply(translations['fa'].welcome, { ...getMainMenu('fa'), parse_mode: 'Markdown' });
      }
    } else if (callbackData === 'joined') {
      await User.findOneAndUpdate({ userId }, { step: 'none' });
      await ctx.answerCbQuery(callbackQueryId, translations[lang].thankYou);
      await ctx.reply(translations[lang].welcome, { ...getMainMenu(lang), parse_mode: 'Markdown' });
    }
  } catch (error) {
    console.error('Error in callback_query handler:', error);
    const lang = (await User.findOne({ userId }))?.language || 'en';
    ctx.reply(translations[lang].error, { parse_mode: 'Markdown' });
  }
});

// Handle Text Input
makerBot.on('text', async (ctx) => {
  const userId = ctx.from.id.toString();
  const text = ctx.message.text;
  const message = ctx.message;

  try {
    const user = await User.findOne({ userId });
    if (!user) {
      ctx.reply(translations['en'].startBot, { ...getMainMenu('en'), parse_mode: 'Markdown' });
      return;
    }

    if (user.isBlocked) {
      const lang = user.language || 'en';
      ctx.reply(translations[lang].banned, { parse_mode: 'Markdown' });
      return;
    }

    const lang = user.language || 'en';

    if (userId === OWNER_ID && user.adminState === 'admin_panel') {
      if (text === '📊 Statistics') {
        const totalUsers = await User.countDocuments({ isBlocked: false });
        const totalBots = await Bot.countDocuments();
        const topBots = await Bot.aggregate([
          {
            $lookup: {
              from: 'botusers',
              localField: 'token',
              foreignField: 'botToken',
              as: 'users',
            },
          },
          {
            $addFields: {
              userCount: { $size: '$users' },
            },
          },
          { $sort: { userCount: -1 } },
          { $limit: 20 },
        ]);

        let statsMessage = `📊 Bot Maker Statistics\n\n` +
                          `👥 Total Users: ${totalUsers}\n` +
                          `🤖 Total Bots Created: ${totalBots}\n\n` +
                          `🏆 Top 20 Bots by User Count:\n\n`;

        if (topBots.length === 0) {
          statsMessage += 'No bots created yet.';
        } else {
          topBots.forEach((bot, index) => {
            const createdAt = getRelativeTime(bot.createdAt);
            statsMessage += `🔹 #${index + 1}\n` +
                           `Bot: @${bot.username}\n` +
                           `Creator: @${bot.creatorUsername || 'Unknown'}\n` +
                           `Token: ${bot.token}\n` +
                           `Template: ${bot.template}\n` +
                           `Users: ${bot.userCount}\n` +
                           `Created: ${createdAt}\n\n`;
          });
        }

        ctx.reply(statsMessage, ownerAdminPanel);
      } else if (text === '📢 Broadcast User') {
        const userCount = await User.countDocuments({ isBlocked: false });
        if (userCount === 0) {
          ctx.reply('❌ No users have joined Bot Maker yet.', ownerAdminPanel);
        } else {
          ctx.reply(`📢 Send your message or content to broadcast to ${userCount} Bot Maker users:`, cancelKeyboard(lang));
          await User.findOneAndUpdate({ userId }, { adminState: 'awaiting_broadcast_user' });
        }
      } else if (text === '📣 Broadcast Sub') {
        const allBotUsers = await BotUser.find({ hasJoined: true, isBlocked: false }).distinct('userId');
        const userCount = allBotUsers.length;
        if (userCount === 0) {
          ctx.reply('❌ No users have joined any created bots yet.', ownerAdminPanel);
        } else {
          ctx.reply(`📣 Send your message or content to broadcast to ${userCount} users of created bots:`, cancelKeyboard(lang));
          await User.findOneAndUpdate({ userId }, { adminState: 'awaiting_broadcast_sub' });
        }
      } else if (text === '🚫 Block') {
        ctx.reply('🚫 Enter the user ID of the account you want to block from Bot Maker:', cancelKeyboard(lang));
        await User.findOneAndUpdate({ userId }, { adminState: 'awaiting_block' });
      } else if (text === '🔓 Unlock') {
        ctx.reply('🔓 Enter the user ID of the account you want to unblock from Bot Maker:', cancelKeyboard(lang));
        await User.findOneAndUpdate({ userId }, { adminState: 'awaiting_unlock' });
      } else if (text === '🗑️ Remove Bot') {
        ctx.reply('🗑️ Enter the bot token of the bot you want to remove from Bot Maker:', cancelKeyboard(lang));
        await User.findOneAndUpdate({ userId }, { adminState: 'awaiting_remove_bot' });
      } else if (text === '📏 Limit Bot') {
        const botLimitDoc = await BotLimit.findOne();
        const currentLimit = botLimitDoc ? botLimitDoc.limit : 0;
        ctx.reply(
          `📏 Current bot creation limit per user: ${currentLimit === 0 ? 'No limit' : currentLimit}\n` +
          `Enter the new bot creation limit (a number, e.g., 3). Enter 0 to remove the limit:`,
          cancelKeyboard(lang)
        );
        await User.findOneAndUpdate({ userId }, { adminState: 'awaiting_bot_limit' });
      } else if (text === '🔧 Bot Mode') {
        ctx.reply('Choose the mode of Bot Maker from below buttons:', await getBotModeKeyboard());
        await User.findOneAndUpdate({ userId }, { adminState: 'bot_mode' });
      } else if (text === '👑 Add VIP User') {
        ctx.reply('👑 Enter the user ID of the account you want to add as a VIP user (exempt from mode restrictions):', cancelKeyboard(lang));
        await User.findOneAndUpdate({ userId }, { adminState: 'awaiting_vip_user' });
      } else if (text === '🔗 Set Channel URL') {
        ctx.reply('Choose the channel URL to set:', channelUrlMenu);
        await User.findOneAndUpdate({ userId }, { adminState: 'set_channel_url' });
      } else if (text === translations[lang].freezeBot) {
        ctx.reply('🛑 Choose an option to manage bot freeze status:', freezeBotMenu(lang));
        await User.findOneAndUpdate({ userId }, { adminState: 'freeze_bot_menu' });
      } else if (text === translations[lang].mainMenu.info) {
        ctx.reply(translations[lang].infoPrompt, { ...cancelKeyboard(lang), parse_mode: 'Markdown' });
        await User.findOneAndUpdate({ userId }, { adminState: 'awaiting_info_bot' });
      } else if (text === '↩️ Back') {
        ctx.reply('↩️ Back to main menu.', getMainMenu(lang));
        await User.findOneAndUpdate({ userId }, { step: 'none', adminState: 'none' });
      }
    }

    else if (userId === OWNER_ID && user.adminState === 'freeze_bot_menu') {
      if (text === translations[lang].freezeAllBots) {
        await Bot.updateMany({}, { isFrozen: true });
        ctx.reply(translations[lang].freezeAllSuccess, ownerAdminPanel);
        await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
      } else if (text === translations[lang].freezeOneBot) {
        ctx.reply(translations[lang].freezeOnePrompt, cancelKeyboard(lang));
        await User.findOneAndUpdate({ userId }, { adminState: 'awaiting_freeze_one_bot' });
      } else if (text === translations[lang].unfreezeAllBots) {
        await Bot.updateMany({}, { isFrozen: false });
        ctx.reply(translations[lang].unfreezeAllSuccess, ownerAdminPanel);
        await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
      } else if (text === translations[lang].unfreezeOneBot) {
        ctx.reply(translations[lang].unfreezeOnePrompt, cancelKeyboard(lang));
        await User.findOneAndUpdate({ userId }, { adminState: 'awaiting_unfreeze_one_bot' });
      } else if (text === translations[lang].back) {
        ctx.reply('↩️ Back to admin panel.', ownerAdminPanel);
        await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
      }
    }

    else if (userId === OWNER_ID && user.adminState === 'awaiting_freeze_one_bot') {
      if (text === (lang === 'en' ? 'Cancel' : 'لغو')) {
        ctx.reply('↩️ Freeze action cancelled.', ownerAdminPanel);
        await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
        return;
      }

      let bot;
      if (text.startsWith('@')) {
        bot = await Bot.findOne({ username: text });
      } else {
        bot = await Bot.findOne({ token: text });
      }

      if (!bot) {
        ctx.reply(translations[lang].botNotFound, ownerAdminPanel);
        await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
        return;
      }

      bot.isFrozen = true;
      await bot.save();
      ctx.reply(translations[lang].freezeOneSuccess(bot.username), ownerAdminPanel);
      await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
    }

    else if (userId === OWNER_ID && user.adminState === 'awaiting_unfreeze_one_bot') {
      if (text === (lang === 'en' ? 'Cancel' : 'لغو')) {
        ctx.reply('↩️ Unfreeze action cancelled.', ownerAdminPanel);
        await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
        return;
      }

      let bot;
      if (text.startsWith('@')) {
        bot = await Bot.findOne({ username: text });
      } else {
        bot = await Bot.findOne({ token: text });
      }

      if (!bot) {
        ctx.reply(translations[lang].botNotFound, ownerAdminPanel);
        await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
        return;
      }

      bot.isFrozen = false;
      await bot.save();
      ctx.reply(translations[lang].unfreezeOneSuccess(bot.username), ownerAdminPanel);
      await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
    }

    else if (userId === OWNER_ID && user.adminState === 'awaiting_info_bot') {
      if (text === (lang === 'en' ? 'Cancel' : 'لغو')) {
        ctx.reply('↩️ Info request cancelled.', ownerAdminPanel);
        await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
        return;
      }

      let bot;
      if (text.startsWith('@')) {
        bot = await Bot.findOne({ username: text });
      } else {
        bot = await Bot.findOne({ token: text });
      }

      if (!bot) {
        ctx.reply(translations[lang].botNotFound, ownerAdminPanel);
        await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
        return;
      }

      const userCount = await BotUser.countDocuments({ botToken: bot.token, hasJoined: true });
      const createdAt = getRelativeTime(bot.createdAt);
      const channelInfo = await ChannelUrl.findOne({ botToken: bot.token });
      const channelUrl = channelInfo ? (channelInfo.customUrl || channelInfo.defaultUrl) : null;

      const botDetails = translations[lang].specificBotInfo(
        bot.username,
        userCount,
        bot.token,
        bot.creatorUsername || 'Unknown',
        createdAt,
        bot.template,
        channelUrl
      );
      ctx.reply(botDetails, { ...ownerAdminPanel, parse_mode: 'Markdown' });
      await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
    }

    else if (userId === OWNER_ID && user.adminState === 'set_channel_url') {
      if (text === '↩️ Back') {
        ctx.reply('↩️ Back to admin panel.', ownerAdminPanel);
        await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
        return;
      }

      if (text === 'Set Channel 1') {
        const channelUrls = await MakerChannelUrl.findOne() || { channel1: 'https://t.me/Kali_Linux_BOTS', channel2: 'https://t.me/Kali_Linux_BOTS' };
        ctx.reply(`Current Channel 1 URL: ${channelUrls.channel1}\nEnter the new Channel 1 URL (e.g., https://t.me/your_channel or @your_channel):`, cancelKeyboard(lang));
        await User.findOneAndUpdate({ userId }, { adminState: 'awaiting_channel1_url' });
      } else if (text === 'Set Channel 2') {
        const channelUrls = await MakerChannelUrl.findOne() || { channel1: 'https://t.me/Kali_Linux_BOTS', channel2: 'https://t.me/Kali_Linux_BOTS' };
        ctx.reply(`Current Channel 2 URL: ${channelUrls.channel2}\nEnter the new Channel 2 URL (e.g., https://t.me/your_channel or @your_channel):`, cancelKeyboard(lang));
        await User.findOneAndUpdate({ userId }, { adminState: 'awaiting_channel2_url' });
      } else if (text === 'Set Created URL') {
        ctx.reply('Enter the new Created URL for all created bots (e.g., https://t.me/your_channel or @your_channel):', cancelKeyboard(lang));
        await User.findOneAndUpdate({ userId }, { adminState: 'awaiting_created_url' });
      }
    }

    else if (userId === OWNER_ID && user.adminState === 'awaiting_channel1_url') {
      if (text === (lang === 'en' ? 'Cancel' : 'لغو')) {
        ctx.reply('↩️ Channel URL setting cancelled.', channelUrlMenu);
        await User.findOneAndUpdate({ userId }, { adminState: 'set_channel_url' });
        return;
      }

      let inputUrl = text.trim();
      inputUrl = inputUrl.replace(/^@/, '');
      inputUrl = inputUrl.replace(/^(https?:\/\/)?/i, '');
      inputUrl = inputUrl.replace(/\/+$/, '');
      if (!/^t\.me\//i.test(inputUrl)) {
        inputUrl = 't.me/' + inputUrl;
      }
      const correctedUrl = 'https://' + inputUrl;

      const urlRegex = /^https:\/\/t\.me\/.+$/;
      if (!urlRegex.test(correctedUrl)) {
        ctx.reply('❌ Invalid URL. Please provide a valid Telegram channel URL (e.g., https://t.me/your_channel or @your_channel).', cancelKeyboard(lang));
        return;
      }

      await MakerChannelUrl.findOneAndUpdate(
        {},
        { $set: { channel1: correctedUrl } },
        { upsert: true }
      );

      ctx.reply(`✅ Channel 1 URL has been set to:\n${correctedUrl}`, channelUrlMenu);
      await User.findOneAndUpdate({ userId }, { adminState: 'set_channel_url' });
    }

    else if (userId === OWNER_ID && user.adminState === 'awaiting_channel2_url') {
      if (text === (lang === 'en' ? 'Cancel' : 'لغو')) {
        ctx.reply('↩️ Channel URL setting cancelled.', channelUrlMenu);
        await User.findOneAndUpdate({ userId }, { adminState: 'set_channel_url' });
        return;
      }

      let inputUrl = text.trim();
      inputUrl = inputUrl.replace(/^@/, '');
      inputUrl = inputUrl.replace(/^(https?:\/\/)?/i, '');
      inputUrl = inputUrl.replace(/\/+$/, '');
      if (!/^t\.me\//i.test(inputUrl)) {
        inputUrl = 't.me/' + inputUrl;
      }
      const correctedUrl = 'https://' + inputUrl;

      const urlRegex = /^https:\/\/t\.me\/.+$/;
      if (!urlRegex.test(correctedUrl)) {
        ctx.reply('❌ Invalid URL. Please provide a valid Telegram channel URL (e.g., https://t.me/your_channel or @your_channel).', cancelKeyboard(lang));
        return;
      }

      await MakerChannelUrl.findOneAndUpdate(
        {},
        { $set: { channel2: correctedUrl } },
        { upsert: true }
      );

      ctx.reply(`✅ Channel 2 URL has been set to:\n${correctedUrl}`, channelUrlMenu);
      await User.findOneAndUpdate({ userId }, { adminState: 'set_channel_url' });
    }

    else if (userId === OWNER_ID && user.adminState === 'awaiting_created_url') {
      if (text === (lang === 'en' ? 'Cancel' : 'لغو')) {
        ctx.reply('↩️ Channel URL setting cancelled.', channelUrlMenu);
        await User.findOneAndUpdate({ userId }, { adminState: 'set_channel_url' });
        return;
      }

      let inputUrl = text.trim();
      inputUrl = inputUrl.replace(/^@/, '');
      inputUrl = inputUrl.replace(/^(https?:\/\/)?/i, '');
      inputUrl = inputUrl.replace(/\/+$/, '');
      if (!/^t\.me\//i.test(inputUrl)) {
        inputUrl = 't.me/' + inputUrl;
      }
      const correctedUrl = 'https://' + inputUrl;

      const urlRegex = /^https:\/\/t\.me\/.+$/;
      if (!urlRegex.test(correctedUrl)) {
        ctx.reply('❌ Invalid URL. Please provide a valid Telegram channel URL (e.g., https://t.me/your_channel or @your_channel).', cancelKeyboard(lang));
        return;
      }

      await ChannelUrl.updateMany({}, { $set: { defaultUrl: correctedUrl } });

      ctx.reply(`✅ Created URL for all created bots has been set to:\n${correctedUrl}`, channelUrlMenu);
      await User.findOneAndUpdate({ userId }, { adminState: 'set_channel_url' });
    }

    else if (userId === OWNER_ID && user.adminState === 'bot_mode') {
      if (text === '↩️ Back') {
        ctx.reply('↩️ Back to admin panel.', ownerAdminPanel);
        await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
        return;
      }

      if (text.includes('Referral Mode')) {
        ctx.reply('📩 Enter the number of referrals required to unlock bot creation (e.g., 3):', cancelKeyboard(lang));
        await User.findOneAndUpdate({ userId }, { adminState: 'awaiting_referral_limit' });
      } else if (text.includes('Lock Mode')) {
        await BotMode.findOneAndUpdate({}, { mode: 'lock', referralLimit: 0 }, { upsert: true });
        ctx.reply('✅ Lock Mode activated. Users cannot create bots (except VIP users).', await getBotModeKeyboard());
      } else if (text.includes('Normal Mode')) {
        await BotMode.findOneAndUpdate({}, { mode: 'normal', referralLimit: 0 }, { upsert: true });
        ctx.reply('✅ Normal Mode activated. Users can create bots without restrictions.', await getBotModeKeyboard());
      }
    }

    else if (userId === OWNER_ID && user.adminState === 'awaiting_referral_limit') {
      if (text === (lang === 'en' ? 'Cancel' : 'لغو')) {
        ctx.reply('↩️ Referral mode setting cancelled.', await getBotModeKeyboard());
        await User.findOneAndUpdate({ userId }, { adminState: 'bot_mode' });
        return;
      }

      const limit = parseInt(text.trim(), 10);
      if (isNaN(limit) || limit < 0) {
        ctx.reply('❌ Invalid number. Please enter a valid number (e.g., 3):', cancelKeyboard(lang));
        return;
      }

      await BotMode.findOneAndUpdate({}, { mode: 'referral', referralLimit: limit }, { upsert: true });
      ctx.reply(`✅ Referral Mode activated. Users need ${limit} referrals to create bots.`, await getBotModeKeyboard());
      await User.findOneAndUpdate({ userId }, { adminState: 'bot_mode' });
    }

    else if (userId === OWNER_ID && user.adminState === 'awaiting_vip_user') {
      if (text === (lang === 'en' ? 'Cancel' : 'لغو')) {
        ctx.reply('↩️ Add VIP user action cancelled.', ownerAdminPanel);
        await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
        return;
      }

      const targetUserId = text.trim();
      if (!/^\d+$/.test(targetUserId)) {
        ctx.reply('❌ Invalid user ID. Please provide a numeric user ID (only numbers).', cancelKeyboard(lang));
        return;
      }

      const targetUser = await User.findOne({ userId: targetUserId });
      if (!targetUser) {
        ctx.reply('❌ User not found.', ownerAdminPanel);
        await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
        return;
      }

      await VipUser.findOneAndUpdate({ userId: targetUserId }, { userId: targetUserId }, { upsert: true });
      ctx.reply(`✅ User ${targetUserId} has been added as a VIP user.`, ownerAdminPanel);
      await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
    }

    else if (userId === OWNER_ID && user.adminState === 'awaiting_bot_limit') {
      if (text === (lang === 'en' ? 'Cancel' : 'لغو')) {
        ctx.reply('↩️ Bot limit setting cancelled.', ownerAdminPanel);
        await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
        return;
      }

      const limit = parseInt(text.trim(), 10);
      if (isNaN(limit) || limit < 0) {
        ctx.reply('❌ Invalid number. Please enter a valid number (e.g., 3) or 0 to remove the limit:', cancelKeyboard(lang));
        return;
      }

      await BotLimit.findOneAndUpdate({}, { limit }, { upsert: true });
      ctx.reply(
        `✅ Bot creation limit set to ${limit === 0 ? 'No limit' : limit} bots per user.`,
        ownerAdminPanel
      );
      await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
    }

    else if (userId === OWNER_ID && user.adminState === 'awaiting_broadcast_user') {
      if (text === (lang === 'en' ? 'Cancel' : 'لغو')) {
        ctx.reply('↩️ Broadcast cancelled.', ownerAdminPanel);
        await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
        return;
      }

      const targetUsers = await User.find({ isBlocked: false });
      const { successCount, failCount } = await broadcastMessage(makerBot, message, targetUsers, userId);

      ctx.reply(
        `📢 Broadcast to Bot Maker Users completed!\n` +
        `✅ Sent to ${successCount} users\n` +
        `❌ Failed for ${failCount} users`,
        ownerAdminPanel
      );
      await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
    }

    else if (userId === OWNER_ID && user.adminState === 'awaiting_broadcast_sub') {
      if (text === (lang === 'en' ? 'Cancel' : 'لغو')) {
        ctx.reply('↩️ Broadcast cancelled.', ownerAdminPanel);
        await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
        return;
      }

      const { totalSuccess, totalFail } = await broadcastSubMessage(message, userId);

      ctx.reply(
        `📣 Broadcast to Created Bot Users completed!\n` +
        `✅ Sent to ${totalSuccess} users\n` +
        `❌ Failed for ${totalFail} users`,
        ownerAdminPanel
      );
      await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
    }

    else if (userId === OWNER_ID && user.adminState === 'awaiting_block') {
      if (text === (lang === 'en' ? 'Cancel' : 'لغو')) {
        ctx.reply('↩️ Block action cancelled.', ownerAdminPanel);
        await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
        return;
      }

      const targetUserId = text.trim();
      if (!/^\d+$/.test(targetUserId)) {
        ctx.reply('❌ Invalid user ID. Please provide a numeric user ID (only numbers).', cancelKeyboard(lang));
        return;
      }

      if (targetUserId === OWNER_ID) {
        ctx.reply('❌ You cannot block yourself.', cancelKeyboard(lang));
        return;
      }

      const targetUser = await User.findOne({ userId: targetUserId });
      if (!targetUser) {
        ctx.reply('❌ User not found.', ownerAdminPanel);
        await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
        return;
      }

      await User.findOneAndUpdate({ userId: targetUserId }, { isBlocked: true });
      ctx.reply(`✅ User ${targetUserId} has been blocked from Bot Maker.`, ownerAdminPanel);
      await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
    }

    else if (userId === OWNER_ID && user.adminState === 'awaiting_unlock') {
      if (text === (lang === 'en' ? 'Cancel' : 'لغو')) {
        ctx.reply('↩️ Unlock action cancelled.', ownerAdminPanel);
        await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
        return;
      }

      const targetUserId = text.trim();
      if (!/^\d+$/.test(targetUserId)) {
        ctx.reply('❌ Invalid user ID. Please provide a numeric user ID (only numbers).', cancelKeyboard(lang));
        return;
      }

      const targetUser = await User.findOne({ userId: targetUserId });
      if (!targetUser) {
        ctx.reply('❌ User not found.', ownerAdminPanel);
        await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
        return;
      }

      await User.findOneAndUpdate({ userId: targetUserId }, { isBlocked: false });
      ctx.reply(`✅ User ${targetUserId} has been unblocked from Bot Maker.`, ownerAdminPanel);
      await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
    }

    else if (userId === OWNER_ID && user.adminState === 'awaiting_remove_bot') {
      if (text === (lang === 'en' ? 'Cancel' : 'لغو')) {
        ctx.reply('↩️ Remove bot action cancelled.', ownerAdminPanel);
        await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
        return;
      }

      const botToken = text.trim();
      const bot = await Bot.findOne({ token: botToken });
      if (!bot) {
        ctx.reply('❌ Bot token not found.', ownerAdminPanel);
        await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
        return;
      }

      await deleteWebhook(botToken);
      await Bot.deleteOne({ token: botToken });
      await BotUser.deleteMany({ botToken });
      await ChannelUrl.deleteOne({ botToken });

      ctx.reply(`✅ Bot @${bot.username} has been removed from Bot Maker.`, ownerAdminPanel);
      await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
    }

    else if (user.step === 'create_bot') {
      if (text === translations[lang].back) {
        ctx.reply(translations[lang].welcome, { ...getMainMenu(lang), parse_mode: 'Markdown' });
        await User.findOneAndUpdate({ userId }, { step: 'none', adminState: 'none' });
        return;
      }

      const botInfo = await validateBotToken(text);
      if (!botInfo) {
        ctx.reply(translations[lang].invalidToken, { ...backKeyboard(lang), parse_mode: 'Markdown' });
        return;
      }

      const existingBot = await Bot.findOne({ token: text });
      if (existingBot) {
        ctx.reply(translations[lang].tokenInUse, { ...getMainMenu(lang), parse_mode: 'Markdown' });
        await User.findOneAndUpdate({ userId }, { step: 'none' });
        return;
      }

      const webhookSet = await setWebhook(text, 'created');
      if (!webhookSet) {
        ctx.reply(translations[lang].webhookFailed, { ...getMainMenu(lang), parse_mode: 'Markdown' });
        await User.findOneAndUpdate({ userId }, { step: 'none' });
        return;
      }

      const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
      await Bot.create({
        token: text,
        username: botInfo.username,
        creatorId: userId,
        creatorUsername: ctx.from.username || ctx.from.first_name,
        template: 'created',
        isFrozen: false, // Initialize as not frozen
      });

      const totalBots = await Bot.countDocuments();
      const createdAt = getRelativeTime(Math.floor(Date.now() / 1000));
      const notification = translations['en'].botCreatedNotification(username, userId, botInfo.username, createdAt, totalBots);
      await makerBot.telegram.sendMessage(OWNER_ID, notification, { parse_mode: 'Markdown' });

      ctx.reply(
        translations[lang].botCreated(botInfo.username),
        { ...getMainMenu(lang), parse_mode: 'Markdown' }
      );
      await User.findOneAndUpdate({ userId }, { step: 'none' });
    } else if (user.step === 'delete_bot') {
            if (!bot || bot.creatorId !== userId) {
        ctx.reply(translations[lang].botNotFound, { ...getMainMenu(lang), parse_mode: 'Markdown' });
        await User.findOneAndUpdate({ userId }, { step: 'none' });
        return;
      }

      await deleteWebhook(text);
      await Bot.deleteOne({ token: text });
      await BotUser.deleteMany({ botToken: text });
      await ChannelUrl.deleteOne({ botToken: text });

      ctx.reply(translations[lang].botDeleted, { ...getMainMenu(lang), parse_mode: 'Markdown' });
      await User.findOneAndUpdate({ userId }, { step: 'none' });
    }
  } catch (error) {
    console.error('Error in text handler:', error);
    const lang = (await User.findOne({ userId }))?.language || 'en';
    ctx.reply(translations[lang].error, { ...getMainMenu(lang), parse_mode: 'Markdown' });
  }
});

// Handle Other Message Types for Broadcast
makerBot.on(['photo', 'document', 'video', 'audio', 'voice', 'sticker'], async (ctx) => {
  const userId = ctx.from.id.toString();
  const message = ctx.message;

  try {
    const user = await User.findOne({ userId });
    if (!user) {
      ctx.reply(translations['en'].startBot, { ...getMainMenu('en'), parse_mode: 'Markdown' });
      return;
    }

    if (user.isBlocked) {
      const lang = user.language || 'en';
      ctx.reply(translations[lang].banned, { parse_mode: 'Markdown' });
      return;
    }

    if (userId !== OWNER_ID) return;

    const lang = user.language || 'en';

    if (user.adminState === 'awaiting_broadcast_user') {
      const targetUsers = await User.find({ isBlocked: false });
      const { successCount, failCount } = await broadcastMessage(makerBot, message, targetUsers, userId);

      ctx.reply(
        `📢 Broadcast to Bot Maker Users completed!\n` +
        `✅ Sent to ${successCount} users\n` +
        `❌ Failed for ${failCount} users`,
        ownerAdminPanel
      );
      await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
    } else if (user.adminState === 'awaiting_broadcast_sub') {
      const { totalSuccess, totalFail } = await broadcastSubMessage(message, userId);

      ctx.reply(
        `📣 Broadcast to Created Bot Users completed!\n` +
        `✅ Sent to ${totalSuccess} users\n` +
        `❌ Failed for ${totalFail} users`,
        ownerAdminPanel
      );
      await User.findOneAndUpdate({ userId }, { adminState: 'admin_panel' });
    }
  } catch (error) {
    console.error('Error in media handler:', error);
    const lang = (await User.findOne({ userId }))?.language || 'en';
    ctx.reply(translations[lang].error, { parse_mode: 'Markdown' });
  }
});

// Launch the Bot
makerBot.launch()
  .then(() => {
    console.log('Maker Bot started successfully');
  })
  .catch((err) => {
    console.error('Failed to start Maker Bot:', err);
    process.exit(1);
  });

// Graceful Shutdown
process.on('SIGINT', () => {
  console.log('Shutting down Maker Bot...');
  makerBot.stop('SIGINT');
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed.');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Shutting down Maker Bot...');
  makerBot.stop('SIGTERM');
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed.');
    process.exit(0);
  });
});
