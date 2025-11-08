const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const workerSchema = new Schema({
  miner: { type: Schema.Types.ObjectId, ref: "Miner", required: true },
  name: { type: String, required: true },
  lastSeen: { type: Date, default: Date.now },
  difficulty: { type: Number, default: 1 },
  sharesAccepted: { type: Number, default: 0 },
  sharesRejected: { type: Number, default: 0 },
});
module.exports = mongoose.model('Worker', workerSchema);