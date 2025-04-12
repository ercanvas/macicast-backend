const mongoose = require('mongoose');

const streamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  videos: [{
    name: String,
    path: String,
    muxAssetId: String,
    muxPlaybackId: String,
    youtubeId: String,
    thumbnail: String,
    status: {
      type: String,
      enum: ['queued', 'processing', 'ready', 'error'],
      default: 'queued'
    }
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
  }],
  youtubeData: {
    channelId: String,
    channelTitle: String,
    videoCount: Number,
    shuffle: { type: Boolean, default: true }
  }
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

// Add method to get next YouTube video in shuffle mode
streamSchema.methods.getNextYouTubeVideo = function() {
  if (!this.videos || this.videos.length === 0) {
    return null;
  }
  
  if (this.youtubeData && this.youtubeData.shuffle) {
    // Get random video that's ready
    const readyVideos = this.videos.filter(v => v.status === 'ready');
    if (readyVideos.length === 0) {
      return null;
    }
    const randomIndex = Math.floor(Math.random() * readyVideos.length);
    return readyVideos[randomIndex];
  } else {
    // Get next video in sequence
    let nextIndex = this.currentVideoIndex + 1;
    if (nextIndex >= this.videos.length) {
      nextIndex = 0;
    }
    this.currentVideoIndex = nextIndex;
    return this.videos[nextIndex];
  }
};

module.exports = mongoose.model('Stream', streamSchema);
