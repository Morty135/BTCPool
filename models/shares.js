const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const shareSchema = new Schema({
  miner: { type: Schema.Types.ObjectId, ref: "Miner", required: true },
  worker: { type: Schema.Types.ObjectId, ref: "Worker", required: true },
  timestamp: { type: Date, default: Date.now, index: true },
  difficulty: { type: Number, required: true },
  accepted: { type: Boolean, default: true },
  height: { type: Number, required: true }
});

module.exports = mongoose.model('Share', shareSchema);