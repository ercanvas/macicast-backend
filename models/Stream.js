const mongoose = require('mongoose');

const streamSchema = new mongoose.Schema({
<<<<<<< HEAD
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
=======
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
    currentVideoIndex: { type: Number, default: 0 },
    playbackUrl: String,
    error: String,
    type: { type: String, default: 'live' },
    userStreams: [{
        id: String,
        name: String,
        url: String,
        type: { type: String, default: 'user-stream' },
        status: { type: String, default: 'active' }
    }],
    createdAt: { type: Date, default: Date.now }
});

// Add method to handle user streams
streamSchema.methods.addUserStream = function(streamData) {
    if (!this.userStreams) {
        this.userStreams = [];
    }
    this.userStreams.push({
        id: streamData.id,
        name: streamData.name,
        url: streamData.url,
        type: streamData.type || 'user-stream',
        status: streamData.status || 'active'
    });
    return this.save();
>>>>>>> 5c75cba6dc6136b731834785cdc891f4812d4213
};

module.exports = mongoose.model('Stream', streamSchema);
