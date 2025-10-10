const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  username: String,
  ip: String,
  difficulty: { type: Number, default: 1 },
  extranonce: String,
  lastActivity: { type: Date, default: Date.now },
  status: { type: String, enum: ['active', 'closed'], default: 'active' }
});

module.exports = mongoose.model('Session', sessionSchema);