const mongoose = require('mongoose');

const streamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  videos: [{
    name: String,
    path: String,
    muxAssetId: String,
    muxPlaybackId: String
  }],
  status: {
    type: String,
    enum: ['queued', 'processing', 'active', 'error', 'stopped'],
    default: 'queued'
  },
  currentVideoIndex: {
    type: Number,
    default: 0
  },
  playbackUrl: String,
  error: String,
  type: { type: String, default: 'live' },
  streams: [{
    id: String,
    url: String,
    type: { type: String, default: 'live' }
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Stream', streamSchema);
