const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('Missing MONGO_URI environment variable, you dumb fuck');
  process.exit(1);
}

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected for token API, you slick fuck'))
  .catch((err) => {
    console.error('MongoDB connection error, you shitty fuck:', err);
    process.exit(1);
  });

const SessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  botToken: { type: String, required: true },
  userId: { type: String, required: true },
  createdAt: { type: Number, default: () => Math.floor(Date.now() / 1000) },
  expiresAt: { type: Number, default: () => Math.floor(Date.now() / 1000) + 172800 }, // 48 hours
});

const Session = mongoose.model('Session', SessionSchema);

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET') {
      console.log('Invalid method:', req.method);
      return res.status(405).json({ ok: false, error: 'Method not allowed, you dumb fuck' });
    }

    const { session } = req.query;
    if (!session) {
      console.log('No session ID provided in query');
      return res.status(400).json({ ok: false, error: 'No session ID provided, you fucking idiot' });
    }

    console.log(`Looking up session: ${session}`);
    const sessionDoc = await Session.findOne({ sessionId: session });
    if (!sessionDoc) {
      console.log(`Session not found: ${session}`);
      return res.status(404).json({ ok: false, error: 'Session not found, you slow fuck' });
    }

    if (sessionDoc.expiresAt < Math.floor(Date.now() / 1000)) {
      console.log(`Session expired: ${session}, expiresAt=${sessionDoc.expiresAt}`);
      return res.status(404).json({ ok: false, error: 'Session expired, you slow fuck' });
    }

    console.log(`Session found: ${session}, returning token: ${sessionDoc.botToken}`);
    res.status(200).json({ ok: true, botToken: sessionDoc.botToken });
  } catch (error) {
    console.error('Error in getToken, you clumsy fuck:', error);
    res.status(500).json({ ok: false, error: 'Server fucked up, try again' });
  }
};
