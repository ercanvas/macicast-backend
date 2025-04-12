const mongoose = require('mongoose');

const streamSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  channel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', required: true },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  duration: { type: Number }, // in seconds
  quality: { type: String, enum: ['SD', 'HD', '4K'] },
  device: { type: String },
  ipAddress: { type: String },
  status: { type: String, enum: ['active', 'ended', 'error'], default: 'active' }
}, { timestamps: true });

// Calculate duration when stream ends
streamSchema.pre('save', function(next) {
  if (this.endTime && this.startTime) {
    this.duration = Math.floor((this.endTime - this.startTime) / 1000);
  }
  next();
});

module.exports = mongoose.model('Stream', streamSchema);
