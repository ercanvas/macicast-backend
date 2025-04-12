const mongoose = require('mongoose');

// Simple stream schema that avoids complex operations
const streamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  videos: [{
    name: String,
    path: String,
    status: String
  }],
  status: { type: String, default: 'queued' },
  playbackUrl: String,
  createdAt: { type: Date, default: Date.now }
});

// Avoid registering model if already exists (helps prevent runtime errors)
module.exports = mongoose.models.Stream || mongoose.model('Stream', streamSchema); 