const mongoose = require('mongoose');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    minlength: 3,
    maxlength: 30,
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers and underscores']
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    select: false // Don't include password in queries by default
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  profilePicture: {
    type: String,
    default: '/default-avatar.png'
  },
  role: {
    type: String,
    enum: ['user', 'moderator', 'admin', 'technical'],
    default: 'user'
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  channelLists: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    channels: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Channel'
    }],
    isDefault: {
      type: Boolean,
      default: false
    },
    isPublic: {
      type: Boolean,
      default: false
    }
  }],
  watchParties: [{
    partyId: {
      type: String,
      default: () => crypto.randomBytes(4).toString('hex') // 8 character unique ID
    },
    passkey: {
      type: String,
      default: () => Math.floor(100000 + Math.random() * 900000).toString() // 6 digit passkey
    },
    name: {
      type: String,
      required: true
    },
    currentChannel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Channel'
    },
    activeUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    createdAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
    }
  }]
}, { timestamps: true });

// Add virtual field for full watch party URL
UserSchema.virtual('watchParties.fullUrl').get(function() {
  return `https://macicast.vercel.app/${this.username}-watch-party/${this.partyId}/${this.currentChannel ? this.currentChannel.name.replace(/\s+/g, '-').toLowerCase() : 'channel'}`;
});

// Create the model if it doesn't already exist
module.exports = mongoose.models.User || mongoose.model('User', UserSchema); 