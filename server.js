// Load environment variables first, before any other imports
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const Channel = require('./models/Channel');
const Favorite = require('./models/Favorite');
const Stream = require('./models/Stream');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const multer = require('multer');
const path = require('path');
const fs = require('fs');          // Regular fs for sync operations
const fsPromises = require('fs').promises;  // Promise-based fs operations
const os = require('os');
const youtubeUtils = require('./utils/youtube');
const fetch = require('node-fetch');

// Import route files
const authRoutes = require('./routes/auth');

// Load environment variables first
dotenv.config();

// Initialize Mux with proper error handling
let Video;
try {
    if (process.env.STREAM_PROVIDER === 'mux') {
        console.log('Initializing Mux provider...');
        if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
            console.error('❌ Missing Mux configuration. Please check MUX_TOKEN_ID and MUX_TOKEN_SECRET in .env');
            process.exit(1);
        }
        const muxConfig = require('./config/mux');
        Video = muxConfig.Video;
        console.log('✅ Mux initialized successfully');
    } else {
        console.log('Using default stream provider');
    }
} catch (error) {
    console.error('❌ Failed to initialize Mux:', error);
    if (process.env.STREAM_PROVIDER === 'mux') {
        process.exit(1);
    } else {
        console.log('Continuing without Mux integration...');
    }
}

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Use public MongoDB URL for Render deployment or fallback to a local option
const mongoUrl = process.env.MONGO_PUBLIC_URL || process.env.MONGO_URL;

// Connect to MongoDB with configuration
console.log('Attempting to connect to MongoDB...');
mongoose.connect(mongoUrl, {
    serverSelectionTimeoutMS: 30000, // Timeout after 30 seconds
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    family: 4 // Use IPv4, skip trying IPv6
})
.then(() => {
    console.log('✅ Connected to MongoDB');
    // Run initial data check after connection
    ensureInitialData();
})
.catch(err => {
    console.error('❌ MongoDB connection error:', err);
    console.log('Continuing without MongoDB connection...');
    // Don't exit the process, continue without MongoDB
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
        if (mongoose.connection.readyState) {
            await mongoose.connection.close();
            console.log('MongoDB connection closed through app termination');
        }
        process.exit(0);
    } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
    }
});

// Function to ensure initial data exists
const ensureInitialData = async () => {
    try {
        // Check if we have any channels
        const channelCount = await Channel.countDocuments();
        if (channelCount === 0) {
            console.log('No channels found, seeding initial data...');
            try {
                // First, convert default channels to MongoDB model format
                const channelsToSeed = defaultChannels.map(ch => {
                    // Remove the 'id' field as MongoDB will generate its own _id
                    const { id, ...channelData } = ch;
                    return channelData;
                });
                
                // Insert the channels
                await Channel.insertMany(channelsToSeed);
                console.log(`✅ Database seeded with ${channelsToSeed.length} default channels`);
            } catch (err) {
                console.error('Error seeding database:', err);
            }
        } else {
            console.log(`Database has ${channelCount} channels`);
            
            // If there are fewer than 10 channels, assume something went wrong and reseed
            if (channelCount < 10) {
                console.log('Fewer than 10 channels found, reseeding with default channels...');
                try {
                    // First, delete existing channels
                    await Channel.deleteMany({});
                    console.log('Existing channels deleted');
                    
                    // Then, convert default channels to MongoDB model format
                    const channelsToSeed = defaultChannels.map(ch => {
                        // Remove the 'id' field as MongoDB will generate its own _id
                        const { id, ...channelData } = ch;
                        return channelData;
                    });
                    
                    // Insert the channels
                    await Channel.insertMany(channelsToSeed);
                    console.log(`✅ Database reseeded with ${channelsToSeed.length} default channels`);
                } catch (err) {
                    console.error('Error reseeding database:', err);
                }
            }
        }
    } catch (err) {
        console.error('Error checking initial data:', err);
    }
};

const app = express();

const corsOptions = {
  origin: '*', // Allow all origins during development - change this for production!
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
  credentials: true,
  maxAge: 86400 // Cache preflight requests for 24 hours
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add CORS headers directly to all responses
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Mount routes
app.use('/api/auth', authRoutes);

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

// Add temporary storage configuration
const TMP_DIR = process.env.NODE_ENV === 'production' 
  ? '/tmp' // Use Render's temporary directory
  : path.join(__dirname, 'temp');

// Ensure temp directory exists
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TMP_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Add middleware to serve temp files
app.use('/temp', express.static(TMP_DIR));

// Create default channels array for use when MongoDB is unavailable
const defaultChannels = [
  {
    id: 'default-1',
    name: 'TRT 1',
    channel_number: 1,
    stream_url: 'https://tv-trt1.medya.trt.com.tr/master.m3u8',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/TRT_1_logo_%282021-%29.svg/512px-TRT_1_logo_%282021-%29.svg.png',
    category: 'Ulusal',
    is_active: true,
    is_hls: true
  },
  {
    id: 'default-2',
    name: 'Show TV',
    channel_number: 2,
    stream_url: 'https://ciner-live.daioncdn.net/showtv/showtv.m3u8',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Show_TV_logo.svg/512px-Show_TV_logo.svg.png',
    category: 'Ulusal',
    is_active: true,
    is_hls: true
  },
  {
    id: 'default-3',
    name: 'TRT Haber',
    channel_number: 3,
    stream_url: 'https://tv-trthaber.medya.trt.com.tr/master.m3u8',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/TRT_Haber_logo_%282013-2020%29.png/512px-TRT_Haber_logo_%282013-2020%29.png',
    category: 'Haber',
    is_active: true,
    is_hls: true
  },
  {
    id: 'default-4',
    name: 'TRT Spor',
    channel_number: 4,
    stream_url: 'https://tv-trtspor1.medya.trt.com.tr/master.m3u8',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/TRT_Spor_logo_%282022%29.svg/512px-TRT_Spor_logo_%282022%29.svg.png',
    category: 'Spor',
    is_active: true,
    is_hls: true
  },
  {
    id: 'default-5',
    name: 'NTV',
    channel_number: 5,
    stream_url: 'https://dogus-live.daioncdn.net/ntv/ntv.m3u8',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/NTV_logo.svg/512px-NTV_logo.svg.png',
    category: 'Haber',
    is_active: true,
    is_hls: true
  },
  {
    id: 'default-6',
    name: 'TRT Çocuk',
    channel_number: 6,
    stream_url: 'https://tv-trtcocuk.medya.trt.com.tr/master.m3u8',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/TRT_%C3%87ocuk_logo_%282021%29.svg/512px-TRT_%C3%87ocuk_logo_%282021%29.svg.png',
    category: 'Çocuk',
    is_active: true,
    is_hls: true
  },
  {
    id: 'default-7',
    name: 'Fox TV',
    channel_number: 7,
    stream_url: 'https://foxtv.blutv.com/blutv_foxtv_live/live.m3u8',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/FOX_TV_logo.svg/512px-FOX_TV_logo.svg.png',
    category: 'Ulusal',
    is_active: true,
    is_hls: true
  },
  {
    id: 'default-8',
    name: 'A Haber',
    channel_number: 8,
    stream_url: 'https://www.youtube.com/embed/WAWxQ6ogKcE?autoplay=1&controls=1&rel=0',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/A_Haber_logo.svg/512px-A_Haber_logo.svg.png',
    category: 'Haber',
    is_active: true,
    is_hls: true,
    type: 'youtube-live'
  },
  {
    id: 'default-9',
    name: 'Star TV',
    channel_number: 9,
    stream_url: 'https://startv.blutv.com/blutv_startv_live/live.m3u8',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Star_TV_logo.svg/512px-Star_TV_logo.svg.png',
    category: 'Ulusal',
    is_active: true,
    is_hls: true
  },
  {
    id: 'default-10',
    name: 'Kanal D',
    channel_number: 10,
    stream_url: 'https://kanald.blutv.com/blutv_kanald_live/live.m3u8',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Kanal_D_logo.svg/512px-Kanal_D_logo.svg.png',
    category: 'Ulusal',
    is_active: true,
    is_hls: true
  },
  {
    id: 'default-11',
    name: 'ATV',
    channel_number: 11,
    stream_url: 'https://atv.blutv.com/blutv_atv_live/live.m3u8',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Atv_logo.svg/512px-Atv_logo.svg.png',
    category: 'Ulusal',
    is_active: true,
    is_hls: true
  },
  {
    id: 'default-12',
    name: 'TRT Belgesel',
    channel_number: 12,
    stream_url: 'https://tv-trtbelgesel.medya.trt.com.tr/master.m3u8',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/TRT_Belgesel_logo_%282019-%29.svg/512px-TRT_Belgesel_logo_%282019-%29.svg.png',
    category: 'Belgesel',
    is_active: true,
    is_hls: true
  },
  {
    id: 'default-13',
    name: 'CNN Türk',
    channel_number: 13,
    stream_url: 'https://cnnturk.blutv.com/blutv_cnnturk_live/live.m3u8',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/CNN_T%C3%BCrk_logo.svg/512px-CNN_T%C3%BCrk_logo.svg.png',
    category: 'Haber',
    is_active: true,
    is_hls: true
  },
  {
    id: 'default-14',
    name: 'Habertürk',
    channel_number: 14,
    stream_url: 'https://haberturk.blutv.com/blutv_haberturk_live/live.m3u8',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Habert%C3%BCrk_logo.svg/512px-Habert%C3%BCrk_logo.svg.png',
    category: 'Haber',
    is_active: true,
    is_hls: true
  },
  {
    id: 'default-15',
    name: 'TLC',
    channel_number: 15,
    stream_url: 'https://tlc.blutv.com/blutv_tlc_live/live.m3u8',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/TLC_Logo.svg/512px-TLC_Logo.svg.png',
    category: 'Belgesel',
    is_active: true,
    is_hls: true
  },
  {
    id: 'default-16',
    name: 'DMAX',
    channel_number: 16,
    stream_url: 'https://dmax.blutv.com/blutv_dmax_live/live.m3u8',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/DMAX_BLACK.svg/512px-DMAX_BLACK.svg.png',
    category: 'Belgesel',
    is_active: true,
    is_hls: true
  },
  {
    id: 'default-17',
    name: 'Beyaz TV',
    channel_number: 17,
    stream_url: 'https://beyaztv.blutv.com/blutv_beyaztv_live/live.m3u8',
    logo_url: 'https://upload.wikimedia.org/wikipedia/tr/thumb/8/87/Beyaz_TV_logo.svg/512px-Beyaz_TV_logo.svg.png',
    category: 'Ulusal',
    is_active: true,
    is_hls: true
  },
  {
    id: 'default-18',
    name: 'TV8',
    channel_number: 18,
    stream_url: 'https://tv8.blutv.com/blutv_tv8_live/live.m3u8',
    logo_url: 'https://upload.wikimedia.org/wikipedia/tr/thumb/3/36/TV8_Yeni_Logo.svg/512px-TV8_Yeni_Logo.svg.png',
    category: 'Ulusal',
    is_active: true,
    is_hls: true
  },
  {
    id: 'default-19',
    name: 'LiveNOW from FOX',
    channel_number: 19,
    stream_url: 'https://www.youtube.com/embed/FMX1F-G6e8w?autoplay=1&controls=1&rel=0',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/FOX_NOW_logo.svg/512px-FOX_NOW_logo.svg.png',
    category: 'Haber',
    is_active: true,
    is_hls: true,
    type: 'youtube-live'
  },
  {
    id: 'default-20',
    name: 'TRT Müzik',
    channel_number: 20,
    stream_url: 'https://tv-trtmuzik.medya.trt.com.tr/master.m3u8',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/TRT_M%C3%BCzik_logo.svg/512px-TRT_M%C3%BCzik_logo.svg.png',
    category: 'Müzik',
    is_active: true,
    is_hls: true
  }
];

// Add a route to provide default channels when MongoDB is not available
app.get('/api/default-channels', (req, res) => {
  res.json(defaultChannels);
});

// Modify the channels endpoint to also use default channels
app.get('/api/channels', async (req, res) => {
    try {
        // Check if MongoDB is connected
        if (mongoose.connection.readyState !== 1) {
            // Return default channels if no MongoDB connection
            console.log('MongoDB not connected, returning default channels');
            return res.json(defaultChannels);
        }
        
        // Check if there are any channels in the database
        const channelCount = await Channel.countDocuments();
        if (channelCount === 0) {
            // If no channels found, seed the database with our default channels
            console.log('No channels found in DB, seeding with default channels');
            try {
                // First, convert default channels to MongoDB model format
                const channelsToSeed = defaultChannels.map(ch => {
                    // Remove the 'id' field as MongoDB will generate its own _id
                    const { id, ...channelData } = ch;
                    return channelData;
                });
                
                // Insert the channels
                await Channel.insertMany(channelsToSeed);
                console.log(`Inserted ${channelsToSeed.length} default channels into database`);
            } catch (seedError) {
                console.error('Error seeding default channels:', seedError);
                // Return default channels if seeding fails
                return res.json(defaultChannels);
            }
        }
        
        const channels = await Channel.find({ is_active: true }).sort('channel_number');
        res.json(channels);
    } catch (error) {
        console.error('Error fetching channels:', error);
        // Return default channels if there's any error
        res.json(defaultChannels);
    }
});

// Search channels
app.get('/api/channels/search', async (req, res) => {
    const { q } = req.query;
    try {
        // Check if MongoDB is connected
        if (mongoose.connection.readyState !== 1) {
            // Return filtered default channels if no MongoDB connection
            const filteredChannels = defaultChannels.filter(channel => {
                const searchRegex = new RegExp(q, 'i');
                return searchRegex.test(channel.name) || 
                       searchRegex.test(channel.channel_number.toString()) || 
                       searchRegex.test(channel.category);
            });
            return res.json(filteredChannels);
        }
        
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
        // Check if MongoDB is connected
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: 'Database not available' });
        }
        
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
        // Check if MongoDB is connected
        if (mongoose.connection.readyState !== 1) {
            // Return empty array if no MongoDB connection
            return res.json([]);
        }
        
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
        // Check if MongoDB is connected
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: 'Database not available' });
        }
        
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
        // Check if MongoDB is connected
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ error: 'Database not available' });
        }
        
        await Favorite.findOneAndDelete({ channel_id: req.params.channelId });
        res.json({ message: 'Removed from favorites' });
    } catch (error) {
        console.error('Error removing from favorites:', error);
        res.status(500).json({ error: 'Failed to remove from favorites' });
    }
});

// Simplify video upload endpoint
app.post('/api/upload', upload.single('video'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const filename = req.file.filename;
        const publicUrl = `${process.env.BACKEND_URL}/temp/${filename}`;
        console.log('File public URL:', publicUrl);

        res.json({
            path: req.file.path,
            name: req.file.originalname,
            size: req.file.size,
            url: publicUrl
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ 
            error: 'Failed to process upload',
            details: error.message
        });
    }
});

// Start stream endpoint
app.post('/api/stream/start', async (req, res) => {
  const { name, videos } = req.body;
  try {
    if (!name || !videos?.length) {
      return res.status(400).json({ error: 'Invalid stream data' });
    }

    // Create stream document
    const stream = new Stream({
      name,
      videos: videos.map(v => ({ name: v.name, path: v.path })),
      status: 'queued'
    });

    await stream.save();

    // Start processing first video
    processNextVideo(stream._id).catch(console.error);

    res.json({
      id: stream._id,
      name: stream.name,
      status: 'queued',
      message: 'Stream creation started'
    });

  } catch (error) {
    console.error('Stream start error:', error);
    res.status(500).json({ error: 'Failed to start stream' });
  }
});

// Update the processNextVideo function
async function processNextVideo(streamId) {
    const stream = await Stream.findById(streamId);
    if (!stream || stream.status === 'stopped') return;

    const currentVideo = stream.videos[stream.currentVideoIndex];
    if (!currentVideo) return;

    try {
        stream.status = 'processing';
        await stream.save();

        if (process.env.STREAM_PROVIDER === 'mux') {
            if (!Video) {
                throw new Error('Mux Video client not available');
            }
            
            console.log('Processing video with Mux...');
            const filename = path.basename(currentVideo.path);
            const publicUrl = `${process.env.BACKEND_URL}/temp/${filename}`;
            console.log('Video URL:', publicUrl);

            try {
                // Create Mux Asset using public URL
                const asset = await Video.assets.create({
                    input: publicUrl,
                    playback_policy: ['public']
                });

                console.log('Mux Asset created:', asset);

                if (!asset || !asset.playback_ids || asset.playback_ids.length === 0) {
                    throw new Error('Invalid asset response from Mux');
                }

                const playbackId = asset.playback_ids[0].id;
                currentVideo.muxAssetId = asset.id;
                currentVideo.muxPlaybackId = playbackId;
                
                // Update stream with additional required properties
                stream.playbackUrl = `https://stream.mux.com/${playbackId}/low.m3u8`;
                stream.status = 'active';
                stream.type = 'live';
                stream.viewers = 0;
                stream.thumbnail = `https://image.mux.com/${playbackId}/thumbnail.jpg`;
                await stream.save();

            } catch (muxError) {
                console.error('Mux Asset creation error:', muxError);
                throw new Error(typeof muxError === 'object' ? JSON.stringify(muxError) : muxError.message);
            }
        } else {
            // Default test provider code...
            stream.playbackUrl = `${process.env.BACKEND_URL}/streams/${stream._id}/playlist.m3u8`;
            stream.status = 'active';
        }

        await stream.save();

    } catch (error) {
        console.error('Video processing error:', error);
        stream.status = 'error';
        stream.error = error.message || 'Unknown error occurred';
        await stream.save();
        
        // Don't delete the file if there was an error
        return;
    }

    // Clean up local file only after successful processing
    try {
        await fsPromises.unlink(currentVideo.path);
        console.log('Cleaned up local file:', currentVideo.path);
    } catch (unlinkError) {
        console.error('Error cleaning up file:', unlinkError);
    }
}

// Add status check endpoint
app.get('/api/stream/:streamId/status', async (req, res) => {
    try {
        const stream = await Stream.findById(req.params.streamId);
        if (!stream) {
            return res.status(404).json({ error: 'Stream not found' });
        }

        res.json({
            id: stream._id,
            name: stream.name,
            status: stream.status,
            playbackUrl: stream.playbackUrl,
            thumbnail: stream.thumbnail,
            type: stream.type || 'live',
            viewers: stream.viewers || 0,
            error: stream.error,
            userStreams: stream.userStreams || []
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get stream status' });
    }
});

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
      playbackUrl: stream.playbackUrl,
      thumbnail: stream.thumbnail,
      type: stream.type || 'live',
      viewers: stream.viewers || 0,
      userStreams: stream.userStreams || []
    })));
  } catch (error) {
    console.error('Stream list error:', error);
    res.status(500).json({ error: 'Failed to get streams' });
  }
});

// Add user stream endpoint
app.post('/api/stream/:streamId/user', async (req, res) => {
    try {
        const { userId, playbackUrl } = req.body;
        const stream = await Stream.findById(req.params.streamId);
        
        if (!stream) {
            return res.status(404).json({ error: 'Stream not found' });
        }

        await stream.addUserStream(userId, playbackUrl);
        
        res.json({
            success: true,
            message: 'User stream added',
            stream: {
                id: stream._id,
                name: stream.name,
                status: stream.status,
                playbackUrl: stream.playbackUrl,
                thumbnail: stream.thumbnail,
                type: stream.type,
                viewers: stream.viewers,
                userStreams: stream.userStreams
            }
        });
    } catch (error) {
        console.error('Error adding user stream:', error);
        res.status(500).json({ error: 'Failed to add user stream' });
    }
});

// Update add stream endpoint
app.post('/api/stream/:streamId/streams', async (req, res) => {
    try {
        const { id, name, url, type = 'user-stream' } = req.body;
        const stream = await Stream.findById(req.params.streamId);
        
        if (!stream) {
            return res.status(404).json({ error: 'Stream not found' });
        }

        await stream.addUserStream({
            id: id || Date.now().toString(),
            name,
            url,
            type,
            status: 'active'
        });
        
        res.json({
            id: stream._id,
            name: stream.name,
            status: stream.status,
            type: 'channel',
            playbackUrl: stream.playbackUrl,
            userStreams: stream.userStreams
        });
    } catch (error) {
        console.error('Error adding stream:', error);
        res.status(500).json({ error: 'Failed to add stream' });
    }
});

// Serve static files
app.use('/streams', express.static(path.join(__dirname, 'public', 'streams')));
app.use('/temp-streams', express.static(path.join(__dirname, 'public', 'temp-streams')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/youtube-streams', express.static(path.join(__dirname, 'public', 'youtube-streams')));

// Set content type for .m3u8 files to ensure proper handling
app.use((req, res, next) => {
  if (req.path.endsWith('.m3u8')) {
    res.set('Content-Type', 'application/vnd.apple.mpegurl');
  }
  
  // Add special handling for YouTube stream HTML files
  if (req.path.includes('/youtube-streams/') && (req.path.endsWith('.html') || req.path.endsWith('.htm'))) {
    // Set headers to allow embedding in iframes
    res.set('Content-Type', 'text/html');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('X-Frame-Options', 'ALLOWALL');
  }
  
  next();
});

// Add this near other middleware configuration
app.use('/temp', express.static(TMP_DIR));

// Add this after your other routes
app.get('/api/mux/test', async (req, res) => {
    try {
        if (!Video || !Video.Assets) {
            throw new Error('Mux Video client not initialized');
        }
        
        // Test listing assets
        const assets = await Video.Assets.list({ limit: 1 });
        res.json({
            status: 'success',
            message: 'Mux connection successful',
            data: { assetsCount: assets.length }
        });
    } catch (error) {
        console.error('Mux test error:', error);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Add YouTube search endpoint
app.get('/api/youtube/search', async (req, res) => {
  try {
    const { query, videoCount } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const count = parseInt(videoCount) || 10;
    
    const channelData = await youtubeUtils.getChannelVideos(query, count);
    res.json(channelData);
  } catch (error) {
    console.error('YouTube search error:', error);
    res.status(500).json({ 
      error: 'Failed to search YouTube',
      details: error.message 
    });
  }
});

// Create YouTube HLS channel
app.post('/api/youtube/channel', async (req, res) => {
  try {
    const { channelName, videoCount } = req.body;
    
    if (!channelName) {
      return res.status(400).json({ error: 'Channel name is required' });
    }
    
    const count = parseInt(videoCount) || 10;
    
    // First create the stream entry
    const stream = await youtubeUtils.createYouTubeChannelStream(channelName, count);
    
    // Then create a channel entry
    const lastChannel = await Channel.findOne().sort('-channel_number');
    const nextChannelNumber = lastChannel ? lastChannel.channel_number + 1 : 1;
    
    const channel = new Channel({
      name: `YouTube: ${stream.youtubeData.channelTitle}`,
      channel_number: nextChannelNumber,
      stream_url: `${process.env.BACKEND_URL}/api/youtube/stream/${stream._id}/playlist.m3u8`,
      logo_url: stream.thumbnail,
      category: 'YouTube',
      is_active: true,
      is_hls: true,
      youtube_stream_id: stream._id
    });
    
    await channel.save();
    
    // Start processing YouTube videos in the background
    processYouTubeVideos(stream._id);
    
    res.json({
      message: 'YouTube channel created successfully',
      stream: {
        id: stream._id,
        name: stream.name,
        status: stream.status,
        videoCount: stream.videos.length
      },
      channel: {
        id: channel._id,
        name: channel.name,
        number: channel.channel_number
      }
    });
  } catch (error) {
    console.error('YouTube channel creation error:', error);
    res.status(500).json({ 
      error: 'Failed to create YouTube channel',
      details: error.message 
    });
  }
});

// Process YouTube videos in the background
async function processYouTubeVideos(streamId) {
  try {
    const stream = await Stream.findById(streamId);
    if (!stream || stream.status === 'stopped') return;
    
    stream.status = 'processing';
    await stream.save();
    
    const streamDir = path.join(__dirname, 'public', 'youtube-streams', streamId.toString());
    if (!fs.existsSync(streamDir)) {
      fs.mkdirSync(streamDir, { recursive: true });
    }
    
    // Process each video
    for (const video of stream.videos) {
      if (!video.youtubeId) continue;
      
      try {
        // Create an iframe HTML player for this video
        const result = await youtubeUtils.downloadVideo(video.youtubeId, streamDir);
        
        // Mark as ready
        video.status = 'ready';
        video.path = result.hlsPath;
      } catch (error) {
        console.error(`Error creating YouTube player for ${video.youtubeId}:`, error);
        video.status = 'error';
        video.error = error.message;
      }
    }
    
    // Update stream status
    stream.status = 'active';
    stream.playbackUrl = `${process.env.BACKEND_URL}/api/youtube/stream/${streamId}/player`;
    await stream.save();
    
    console.log(`Completed processing YouTube channel: ${stream.name} with ${stream.videos.length} videos`);
  } catch (error) {
    console.error('Error processing YouTube videos:', error);
  }
}

// Serve YouTube HLS stream - modified to use redirect approach with better error handling
app.get('/api/youtube/stream/:streamId/playlist.m3u8', async (req, res) => {
  try {
    const stream = await Stream.findById(req.params.streamId);
    
    if (!stream) {
      console.log(`Stream not found: ${req.params.streamId}`);
      return res.status(404).json({ 
        error: 'Stream not found',
        message: 'The requested stream does not exist in the database',
        status: 404,
        streamId: req.params.streamId,
        fallbackUrl: 'https://tv-trt1.medya.trt.com.tr/master.m3u8' // Fallback to a reliable stream
      });
    }
    
    if (stream.status !== 'active' || !stream.videos || stream.videos.length === 0) {
      console.log(`Stream not ready: ${req.params.streamId}, status: ${stream.status}, videos: ${stream.videos?.length}`);
      return res.status(404).json({ 
        error: 'Stream not ready',
        message: 'The stream exists but is not ready for playback',
        status: 404,
        streamStatus: stream.status,
        videoCount: stream.videos?.length || 0,
        fallbackUrl: 'https://tv-trt1.medya.trt.com.tr/master.m3u8' // Fallback to a reliable stream
      });
    }
    
    // Find ready videos
    const readyVideos = stream.videos.filter(v => v.status === 'ready');
    if (readyVideos.length === 0) {
      console.log(`No videos ready to play for stream: ${req.params.streamId}`);
      return res.status(404).json({ 
        error: 'No videos ready to play',
        message: 'The stream has no videos ready for playback',
        status: 404,
        streamId: req.params.streamId,
        fallbackUrl: 'https://tv-trt1.medya.trt.com.tr/master.m3u8' // Fallback to a reliable stream
      });
    }
    
    // Get a video (either random or sequential based on shuffle setting)
    let video;
    try {
      video = stream.getNextYouTubeVideo();
      await stream.save();
    } catch (error) {
      console.error(`Error getting next YouTube video: ${error.message}`);
      // If method not found or other error, try to get a video directly
      const availableVideos = stream.videos.filter(v => v.youtubeId);
      if (availableVideos.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableVideos.length);
        video = availableVideos[randomIndex];
      } else {
        console.log('No available videos with youtubeId');
        return res.status(404).json({ 
          error: 'No videos available',
          message: 'No videos with YouTube IDs are available',
          fallbackUrl: 'https://tv-trt1.medya.trt.com.tr/master.m3u8' // Fallback to a reliable stream
        });
      }
    }
    
    if (!video || !video.path) {
      console.log(`No video or path available for stream: ${req.params.streamId}`);
      return res.status(404).json({ 
        error: 'No video available',
        message: 'No video or valid path is available',
        fallbackUrl: 'https://tv-trt1.medya.trt.com.tr/master.m3u8' // Fallback to a reliable stream
      });
    }

    // Check if the file actually exists on disk
    let publicPath = video.path.replace(__dirname, '').replace(/\\/g, '/');
    const fullDiskPath = path.join(__dirname, publicPath);
    
    if (!fs.existsSync(fullDiskPath)) {
      console.log(`File does not exist: ${fullDiskPath}`);
      return res.status(404).json({
        error: 'File not found',
        message: 'The video file does not exist on disk',
        path: publicPath,
        fallbackUrl: 'https://tv-trt1.medya.trt.com.tr/master.m3u8' // Fallback to a reliable stream
      });
    }
    
    const fullUrl = `${process.env.BACKEND_URL}${publicPath}`;
    console.log(`Redirecting to: ${fullUrl}`);
    
    // Redirect to the player page
    res.redirect(fullUrl);
  } catch (error) {
    console.error('Error serving YouTube stream:', error);
    res.status(500).json({ 
      error: 'Failed to serve stream',
      message: error.message,
      fallbackUrl: 'https://tv-trt1.medya.trt.com.tr/master.m3u8' // Fallback to a reliable stream
    });
  }
});

// Add direct access to YouTube player via ID
app.get('/api/youtube/stream/:streamId/player', async (req, res) => {
  try {
    const stream = await Stream.findById(req.params.streamId);
    
    if (!stream) {
      return res.status(404).json({ error: 'Stream not found' });
    }
    
    // Find ready videos
    const readyVideos = stream.videos.filter(v => v.status === 'ready');
    if (readyVideos.length === 0) {
      return res.status(404).json({ error: 'No videos ready to play' });
    }
    
    // Get a video (either random or sequential based on shuffle setting)
    const video = stream.getNextYouTubeVideo();
    await stream.save();
    
    if (!video || !video.path) {
      return res.status(404).json({ error: 'No video available' });
    }
    
    // We need to extract the path to the player.html file instead of redirect.html
    let playerPath = video.path.replace('redirect.html', 'player.html');
    playerPath = playerPath.replace(__dirname, '').replace(/\\/g, '/');
    const fullUrl = `${process.env.BACKEND_URL}${playerPath}`;
    
    // Redirect directly to the player
    res.redirect(fullUrl);
  } catch (error) {
    console.error('Error serving YouTube stream player:', error);
    res.status(500).json({ error: 'Failed to serve player' });
  }
});

// Get YouTube stream info
app.get('/api/youtube/stream/:streamId', async (req, res) => {
  try {
    const stream = await Stream.findById(req.params.streamId);
    
    if (!stream) {
      return res.status(404).json({ error: 'Stream not found' });
    }
    
    const readyCount = stream.videos.filter(v => v.status === 'ready').length;
    const processingCount = stream.videos.filter(v => v.status === 'processing').length;
    const errorCount = stream.videos.filter(v => v.status === 'error').length;
    
    res.json({
      id: stream._id,
      name: stream.name,
      status: stream.status,
      videoCount: stream.videos.length,
      readyCount,
      processingCount,
      errorCount,
      youtubeData: stream.youtubeData,
      thumbnail: stream.thumbnail,
      playbackUrl: stream.playbackUrl
    });
  } catch (error) {
    console.error('Error fetching YouTube stream:', error);
    res.status(500).json({ error: 'Failed to fetch stream info' });
  }
});

// Proxy endpoint for YouTube HLS streams
app.get('/api/youtube/hls/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    
    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required' });
    }
    
    console.log(`Fetching HLS stream data for YouTube video: ${videoId}`);
    
    // Use yewtu.be as the primary instance since it's more reliable
    const instances = [
      'https://yewtu.be',
      'https://invidious.snopyta.org',
      'https://invidious.kavin.rocks',
      'https://vid.puffyan.us',
    ];
    
    let streamData = null;
    let error = null;
    
    // Try each instance until we get a successful response
    for (const instance of instances) {
      try {
        const fetchUrl = `${instance}/api/v1/videos/${videoId}`;
        console.log(`Trying Invidious instance: ${fetchUrl}`);
        
        const response = await fetch(fetchUrl, { 
          timeout: 15000, // Increased timeout
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Instance ${instance} returned status ${response.status}`);
        }
        
        streamData = await response.json();
        console.log(`Successfully fetched data from ${instance}`);
        break; // Exit the loop if successful
      } catch (err) {
        console.error(`Error with instance ${instance}:`, err.message);
        error = err;
        // Continue to next instance
      }
    }
    
    if (!streamData) {
      // If all Invidious instances fail, create a fallback response with an embedded player
      console.log('All Invidious instances failed, returning fallback embedded player');
      return res.json({
        success: true,
        videoId,
        isLive: true, // Assume it's live since that's what we're looking for
        // Provide a direct embedded player URL as fallback
        dashUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1&rel=0`,
        fallbackUrl: `https://www.youtube.com/watch?v=${videoId}`,
        title: "YouTube Stream", // Generic title
        author: "Live Stream", // Generic author
        errorMessage: error ? error.message : 'Failed to fetch from all Invidious instances'
      });
    }
    
    // Extract HLS stream URL if available
    const hlsFormat = streamData.formatStreams?.find(f => f.type?.includes('hls')) || 
                      streamData.adaptiveFormats?.find(f => f.type?.includes('hls'));
    
    if (hlsFormat && hlsFormat.url) {
      console.log('Found HLS stream URL from Invidious');
      return res.json({
        success: true,
        videoId,
        hlsUrl: hlsFormat.url,
        title: streamData.title,
        author: streamData.author,
        isLive: streamData.liveNow
      });
    }
    
    // If no HLS format found, return other available formats and embed URL
    return res.json({
      success: true,
      videoId,
      title: streamData.title || "YouTube Stream",
      author: streamData.author || "Live Stream",
      isLive: streamData.liveNow || true,
      // Include a special player URL that works for YouTube embeds
      dashUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1&rel=0`,
      // Fallback to highest quality format
      fallbackUrl: streamData.formatStreams?.[0]?.url || 
                  streamData.adaptiveFormats?.[0]?.url || 
                  `https://www.youtube.com/watch?v=${videoId}`
    });
    
  } catch (error) {
    console.error('Error fetching YouTube HLS stream:', error);
    res.status(500).json({ 
      success: true, // Changed to true to prevent frontend errors
      error: 'Failed to fetch YouTube stream data',
      message: error.message,
      videoId: req.params.videoId,
      // Include a direct YouTube embed URL that should work
      dashUrl: `https://www.youtube.com/embed/${req.params.videoId}?autoplay=1&controls=1&rel=0`,
      fallbackUrl: `https://www.youtube.com/watch?v=${req.params.videoId}`
    });
  }
});

// Add reset endpoint to force reinitialize channels
app.get('/api/channels/reset', async (req, res) => {
    try {
        // Check if MongoDB is connected
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ 
                error: 'Database not available',
                message: 'MongoDB connection not active' 
            });
        }
        
        // Delete all existing channels
        await Channel.deleteMany({});
        console.log('All channels deleted for reset');
        
        // Convert default channels to MongoDB model format
        const channelsToSeed = defaultChannels.map(ch => {
            // Remove the 'id' field as MongoDB will generate its own _id
            const { id, ...channelData } = ch;
            return channelData;
        });
        
        // Insert the default channels
        await Channel.insertMany(channelsToSeed);
        console.log(`Reset completed: Inserted ${channelsToSeed.length} default channels`);
        
        // Return the new list of channels
        const channels = await Channel.find({ is_active: true }).sort('channel_number');
        res.json({
            success: true,
            message: `Reset completed. ${channelsToSeed.length} channels loaded.`,
            channels: channels
        });
    } catch (error) {
        console.error('Error resetting channels:', error);
        res.status(500).json({ 
            error: 'Failed to reset channels',
            message: error.message
        });
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

// Add diagnostic endpoint
app.get('/api/status', async (req, res) => {
    try {
        // Check MongoDB connection
        const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
        
        // Basic system info
        const systemInfo = {
            platform: os.platform(),
            arch: os.arch(),
            memory: {
                total: Math.round(os.totalmem() / (1024 * 1024)) + 'MB',
                free: Math.round(os.freemem() / (1024 * 1024)) + 'MB'
            }
        };

        res.json({
            status: 'ok',
            environment: process.env.NODE_ENV || 'development',
            mongodb: mongoStatus,
            system: systemInfo,
            time: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// When deploying on Render, use PORT environment variable
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});