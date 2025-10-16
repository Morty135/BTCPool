const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Schema = mongoose.Schema;

const minerSchema = new Schema({
  username: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  payoutAddress: { type: String },
  createdAt: { type: Date, default: Date.now },
  notes: { type: String }
});

// hash password helper
minerSchema.methods.setPassword = async function(plainPassword) {
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(plainPassword, salt);
};

// compare password helper
minerSchema.methods.comparePassword = async function(candidate) {
  if (!this.password) return false;
  const isHash = /^(\$2[aby]\$)/.test(this.password);
  if (isHash) {
    return await bcrypt.compare(candidate, this.password);
  }
  return candidate === this.password;
};

module.exports = mongoose.model('Miner', minerSchema);