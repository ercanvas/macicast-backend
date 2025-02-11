const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const Channel = require('./models/Channel');
const Favorite = require('./models/Favorite');
const Stream = require('./models/Stream'); // Add this import at the top
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { CloudFront } = require('@aws-sdk/client-cloudfront');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);
const os = require('os'); // Add this import

dotenv.config();

// Use public MongoDB URL for Render deployment
const mongoUrl = process.env.MONGO_PUBLIC_URL || process.env.MONGO_URL;

// Connect to MongoDB with updated configuration
mongoose.connect(mongoUrl)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1); // Exit if cannot connect to database
    });

// Add MongoDB connection error handler
mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
});

// Add MongoDB disconnection handler
mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
});

// Add process handlers for graceful shutdown
process.on('SIGINT', async () => {
    try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed through app termination');
        process.exit(0);
    } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
    }
});

const app = express();

const corsOptions = {
  origin: [
    'https://macicast.vercel.app',
    'http://localhost:5173', // Development
    'http://localhost:4173'  // Preview
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
  credentials: true,
  maxAge: 86400 // Cache preflight requests for 24 hours
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import required libraries for video handling
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure required directories exist
const ensureDirectories = () => {
  const dirs = [
    path.join(__dirname, 'public'),
    path.join(__dirname, 'public/temp-streams'),
    path.join(__dirname, 'public/streams'),
    path.join(__dirname, 'uploads')
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      console.log(`Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// Call this before setting up routes
ensureDirectories();

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Configure S3
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Get all channels
app.get('/api/channels', async (req, res) => {
    try {
        const channels = await Channel.find({ is_active: true }).sort('channel_number');
        res.json(channels);
    } catch (error) {
        console.error('Error fetching channels:', error);
        res.status(500).json({ error: 'Failed to fetch channels' });
    }
});

// Search channels
app.get('/api/channels/search', async (req, res) => {
    const { q } = req.query;
    try {
        const channels = await Channel.find({
            is_active: true,
            $or: [
                { name: { $regex: q, $options: 'i' } },
                { channel_number: { $regex: q, $options: 'i' } },
                { category: { $regex: q, $options: 'i' } }
            ]
        }).sort('channel_number');
        res.json(channels);
    } catch (error) {
        console.error('Error searching channels:', error);
        res.status(500).json({ error: 'Failed to search channels' });
    }
});

// Add a new channel
app.post('/api/channels', async (req, res) => {
    try {
        const channel = new Channel(req.body);
        await channel.save();
        res.json({ message: 'Channel added successfully', channel });
    } catch (error) {
        console.error('Error adding channel:', error);
        res.status(500).json({ error: 'Failed to add channel' });
    }
});

// Update a channel
app.put('/api/channels/:id', async (req, res) => {
    try {
        const channel = await Channel.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        res.json({ message: 'Channel updated successfully', channel });
    } catch (error) {
        console.error('Error updating channel:', error);
        res.status(500).json({ error: 'Failed to update channel' });
    }
});

// Delete a channel
app.delete('/api/channels/:id', async (req, res) => {
    try {
        await Channel.findByIdAndDelete(req.params.id);
        res.json({ message: 'Channel deleted successfully' });
    } catch (error) {
        console.error('Error deleting channel:', error);
        res.status(500).json({ error: 'Failed to delete channel' });
    }
});

// Get favorite channels
app.get('/api/favorites', async (req, res) => {
    try {
        const favorites = await Favorite.find()
            .populate('channel_id')
            .exec();
        const channels = favorites.map(f => f.channel_id);
        res.json(channels);
    } catch (error) {
        console.error('Error fetching favorites:', error);
        res.status(500).json({ error: 'Failed to fetch favorite channels' });
    }
});

// Add to favorites
app.post('/api/favorites/:channelId', async (req, res) => {
    try {
        const favorite = new Favorite({ channel_id: req.params.channelId });
        await favorite.save();
        res.json({ message: 'Added to favorites' });
    } catch (error) {
        console.error('Error adding to favorites:', error);
        res.status(500).json({ error: 'Failed to add to favorites' });
    }
});

// Remove from favorites
app.delete('/api/favorites/:channelId', async (req, res) => {
    try {
        await Favorite.findOneAndDelete({ channel_id: req.params.channelId });
        res.json({ message: 'Removed from favorites' });
    } catch (error) {
        console.error('Error removing from favorites:', error);
        res.status(500).json({ error: 'Failed to remove from favorites' });
    }
});

// Video upload endpoint
app.post('/api/upload', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({
    path: req.file.path,
    name: req.file.originalname
  });
});

// Start stream endpoint
app.post('/api/stream/start', async (req, res) => {
  const { name, videos } = req.body;
  try {
    if (!name || !videos || !Array.isArray(videos)) {
      return res.status(400).json({ error: 'Invalid stream data' });
    }

    console.log('Creating stream:', { name, videos });

    // Create unique stream ID
    const streamId = new mongoose.Types.ObjectId();
    
    // Ensure directories exist
    const publicDir = path.join(__dirname, 'public');
    const streamsDir = path.join(publicDir, 'temp-streams', streamId.toString());
    
    fs.mkdirSync(publicDir, { recursive: true });
    fs.mkdirSync(streamsDir, { recursive: true });

    // Create stream document
    const stream = new Stream({
      _id: streamId,
      name,
      videos,
      status: 'processing',
      hlsPath: `/temp-streams/${streamId}/playlist.m3u8`
    });

    await stream.save();

    // Generate playback URL
    const playbackUrl = `${process.env.BACKEND_URL}/temp-streams/${streamId}/playlist.m3u8`;
    console.log('Playback URL:', playbackUrl);

    // Return immediately with status
    res.json({
      id: stream._id,
      name: stream.name,
      playbackUrl,
      status: 'processing',
      viewers: 0
    });

    // Process videos in background
    try {
      console.log('Starting video processing...');
      await processVideosInBackground(videos, streamId.toString());
      console.log('Video processing complete');
      
      // Update stream status
      await Stream.findByIdAndUpdate(streamId, { 
        status: 'active'
      });
    } catch (error) {
      console.error('Video processing error:', error);
      await Stream.findByIdAndUpdate(streamId, { 
        status: 'error',
        error: error.message
      });
    }

  } catch (error) {
    console.error('Stream start error:', error);
    res.status(500).json({ 
      error: 'Failed to start stream',
      details: error.message 
    });
  }
});

// Background video processing function
async function processVideosInBackground(videos, streamId) {
  const outputDir = path.join(__dirname, 'public', 'temp-streams', streamId);
  
  try {
    console.log('Processing videos in:', outputDir);
    
    // Process videos one by one
    for (const video of videos) {
      console.log('Processing video:', video.path);
      
      await new Promise((resolve, reject) => {
        ffmpeg(video.path)
          .outputOptions([
            '-c:v libx264',
            '-c:a aac',
            '-f hls',
            '-hls_time 4',
            '-hls_list_size 3',
            '-hls_flags delete_segments+append_list',
            '-hls_segment_filename',
            path.join(outputDir, 'segment_%03d.ts')
          ])
          .output(path.join(outputDir, 'playlist.m3u8'))
          .on('start', (cmd) => console.log('Started ffmpeg:', cmd))
          .on('progress', (progress) => console.log('Processing:', progress.percent, '%'))
          .on('end', () => {
            console.log('Finished processing video');
            resolve();
          })
          .on('error', (err) => {
            console.error('FFmpeg error:', err);
            reject(err);
          })
          .run();
      });
    }

    console.log('All videos processed successfully');
    return true;
  } catch (error) {
    console.error('Video processing failed:', error);
    throw error;
  }
}

// Serve static files
app.use('/streams', express.static(path.join(__dirname, 'public', 'streams')));
app.use('/temp-streams', express.static(path.join(__dirname, 'public', 'temp-streams')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Stop stream endpoint
app.post('/api/stream/stop/:streamId?', async (req, res) => {
  try {
    if (req.params.streamId) {
      const stream = await Stream.findByIdAndUpdate(
        req.params.streamId,
        { status: 'stopped' },
        { new: true }
      );
      if (!stream) {
        return res.status(404).json({ error: 'Stream not found' });
      }
    } else {
      await Stream.updateMany(
        { status: 'active' },
        { status: 'stopped' }
      );
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Stream stop error:', error);
    res.status(500).json({ 
      error: 'Failed to stop stream',
      details: error.message 
    });
  }
});

// Get active streams
app.get('/api/stream/list', async (req, res) => {
  try {
    const streams = await Stream.find({ status: 'active' });
    res.json(streams.map(stream => ({
      id: stream._id,
      name: stream.name,
      playbackUrl: `${process.env.FRONTEND_URL}/stream/${stream._id}`,
      viewers: 0
    })));
  } catch (error) {
    console.error('Stream list error:', error);
    res.status(500).json({ error: 'Failed to get streams' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : {}
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});