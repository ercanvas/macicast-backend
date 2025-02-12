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
};

module.exports = mongoose.model('Stream', streamSchema);
