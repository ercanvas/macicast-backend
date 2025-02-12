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
  viewers: { type: Number, default: 0 },
  thumbnail: String,
  createdAt: { type: Date, default: Date.now },
  userStreams: [{
    userId: String,
    playbackUrl: String,
    status: String
  }]
});

// Add method to handle user streams
streamSchema.methods.addUserStream = function(userId, playbackUrl) {
  this.userStreams = this.userStreams || [];
  this.userStreams.push({
    userId,
    playbackUrl,
    status: 'active'
  });
  return this.save();
};

module.exports = mongoose.model('Stream', streamSchema);
