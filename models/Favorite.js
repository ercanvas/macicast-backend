const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
  channel_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Favorite', favoriteSchema);
