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
    enum: ['active', 'stopped'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Stream', streamSchema);
