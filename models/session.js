const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  username: { type: String, required: true },
  sessionId: { type: String, required: true },
  ip: String,
  difficulty: { type: Number, default: 1 },
  extranonce: String,
  connectedAt: { type: Date, default: Date.now },
  lastActivity: { type: Date, default: Date.now },
  status: { type: String, enum: ['active', 'closed'], default: 'active' }
});

module.exports = mongoose.model('Session', sessionSchema);