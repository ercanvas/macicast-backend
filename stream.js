const mongoose = require('mongoose');

// Simplified Stream schema to avoid model conflicts
const streamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  videos: [{
    name: String,
    path: String,
    muxAssetId: String,
    muxPlaybackId: String,
    youtubeId: String,
    thumbnail: String,
    status: String
  }],
  status: { type: String, default: 'queued' },
  currentVideoIndex: { type: Number, default: 0 },
  playbackUrl: String,
  error: String,
  type: { type: String, default: 'live' },
  viewers: { type: Number, default: 0 },
  thumbnail: String,
  createdAt: { type: Date, default: Date.now },
  userStreams: [{
    userId: String,
    playbackUrl: String,
    status: String
  }],
  youtubeData: {
    channelId: String,
    channelTitle: String,
    videoCount: Number,
    shuffle: { type: Boolean, default: true }
  }
}, { timestamps: true });

// This is the original Stream model to maintain compatibility
module.exports = mongoose.model('Stream', streamSchema); 