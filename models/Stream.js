const mongoose = require('mongoose');

const streamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  videos: [{
    name: String,
    path: String
  }],
  status: {
    type: String,
    enum: ['active', 'processing', 'error', 'stopped'],
    default: 'active'
  },
  streamUrl: {
    type: String,
    required: true
  },
  error: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Stream', streamSchema);
