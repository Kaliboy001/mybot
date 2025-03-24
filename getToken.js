const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected for token API, you slick fuck'))
  .catch((err) => console.error('MongoDB connection error, you shitty fuck:', err));

const SessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  botToken: { type: String, required: true },
  userId: { type: String, required: true },
  createdAt: { type: Number, default: () => Math.floor(Date.now() / 1000) },
  expiresAt: { type: Number, default: () => Math.floor(Date.now() / 1000) + 3600 },
});

const Session = mongoose.model('Session', SessionSchema);

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ ok: false, error: 'Method not allowed, you dumb fuck' });
    }

    const { session } = req.query;
    if (!session) {
      return res.status(400).json({ ok: false, error: 'No session ID provided, you fucking idiot' });
    }

    const sessionDoc = await Session.findOne({ sessionId: session });
    if (!sessionDoc || sessionDoc.expiresAt < Math.floor(Date.now() / 1000)) {
      return res.status(404).json({ ok: false, error: 'Session invalid or expired, you slow fuck' });
    }

    res.status(200).json({ ok: true, botToken: sessionDoc.botToken });
  } catch (error) {
    console.error('Error in getToken, you clumsy fuck:', error);
    res.status(500).json({ ok: false, error: 'Server fucked up, try again' });
  }
};
