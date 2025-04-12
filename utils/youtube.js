const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const ffmpeg = require('fluent-ffmpeg');
const Stream = require('../models/Stream');

// Get YouTube channel details and videos
async function getChannelVideos(channelName, videoCount = 10) {
  try {
    // First try to search for the channel
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(channelName)}&type=channel&key=${process.env.YOUTUBE_API_KEY}`;
    
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    
    if (!searchData.items || searchData.items.length === 0) {
      throw new Error('Channel not found');
    }
    
    const channelId = searchData.items[0].id.channelId;
    const channelTitle = searchData.items[0].snippet.title;
    const channelThumbnail = searchData.items[0].snippet.thumbnails.high.url;
    
    // Get channel's videos
    const videosUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&type=video&maxResults=${videoCount}&key=${process.env.YOUTUBE_API_KEY}`;
    
    const videosResponse = await fetch(videosUrl);
    const videosData = await videosResponse.json();
    
    if (!videosData.items || videosData.items.length === 0) {
      throw new Error('No videos found for this channel');
    }
    
    const videos = videosData.items.map(item => ({
      id: item.id.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.high.url,
      publishedAt: item.snippet.publishedAt
    }));
    
    return {
      channelId,
      channelTitle,
      channelThumbnail,
      videos
    };
  } catch (error) {
    console.error('Error fetching YouTube channel:', error);
    throw error;
  }
}

// Download and convert YouTube video to HLS
async function downloadVideo(videoId, outputDir) {
  return new Promise(async (resolve, reject) => {
    try {
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const videoInfo = await ytdl.getInfo(videoId);
      const videoTitle = videoInfo.videoDetails.title.replace(/[^\w\s]/gi, '');
      
      const tempFilePath = path.join(outputDir, `${videoId}.mp4`);
      const hlsOutputPath = path.join(outputDir, videoId);
      
      if (!fs.existsSync(hlsOutputPath)) {
        fs.mkdirSync(hlsOutputPath, { recursive: true });
      }
      
      console.log(`Downloading video: ${videoTitle}`);
      
      // Download the video
      ytdl(videoUrl, { 
        quality: 'highest',
        filter: 'audioandvideo' 
      })
      .pipe(fs.createWriteStream(tempFilePath))
      .on('finish', () => {
        console.log(`Download completed: ${videoTitle}`);
        
        // Convert to HLS
        ffmpeg(tempFilePath)
          .outputOptions([
            '-c:v h264',
            '-c:a aac',
            '-hls_time 10',
            '-hls_list_size 0',
            '-hls_segment_filename', path.join(hlsOutputPath, 'segment%03d.ts'),
            '-f hls'
          ])
          .output(path.join(hlsOutputPath, 'playlist.m3u8'))
          .on('end', () => {
            console.log(`HLS conversion completed: ${videoTitle}`);
            // Delete the temporary file
            fs.unlinkSync(tempFilePath);
            resolve({
              videoId,
              title: videoTitle,
              hlsPath: path.join(hlsOutputPath, 'playlist.m3u8')
            });
          })
          .on('error', (err) => {
            console.error(`Error converting video to HLS: ${err.message}`);
            reject(err);
          })
          .run();
      })
      .on('error', (err) => {
        console.error(`Error downloading video: ${err.message}`);
        reject(err);
      });
    } catch (error) {
      console.error('Error processing YouTube video:', error);
      reject(error);
    }
  });
}

// Create YouTube channel HLS stream
async function createYouTubeChannelStream(channelName, videoCount) {
  try {
    const channelData = await getChannelVideos(channelName, videoCount);
    
    // Create a new stream for this YouTube channel
    const stream = new Stream({
      name: `YouTube: ${channelData.channelTitle}`,
      status: 'queued',
      type: 'youtube',
      thumbnail: channelData.channelThumbnail,
      videos: channelData.videos.map(video => ({
        name: video.title,
        youtubeId: video.id,
        thumbnail: video.thumbnail
      })),
      youtubeData: {
        channelId: channelData.channelId,
        channelTitle: channelData.channelTitle,
        videoCount: channelData.videos.length
      }
    });
    
    await stream.save();
    return stream;
  } catch (error) {
    console.error('Error creating YouTube channel stream:', error);
    throw error;
  }
}

module.exports = {
  getChannelVideos,
  downloadVideo,
  createYouTubeChannelStream
}; 