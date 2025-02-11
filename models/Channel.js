const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  channel_number: { type: Number, required: true },
  stream_url: { type: String, required: true },
  logo_url: { type: String },
  category: { type: String },
  is_active: { type: Boolean, default: true },
  is_hls: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Channel', channelSchema);
