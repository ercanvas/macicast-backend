const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const ffmpeg = require('fluent-ffmpeg');
const Stream = require('../models/Stream');

// Disable ytdl-core update check
process.env.YTDL_NO_UPDATE = 'true';

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
      // Create a YouTube direct player iframe embed
      const hlsOutputPath = path.join(outputDir, videoId);
      
      if (!fs.existsSync(hlsOutputPath)) {
        fs.mkdirSync(hlsOutputPath, { recursive: true });
      }
      
      // Create a direct iframe embed HTML file that will play the YouTube video
      const iframeHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>YouTube Player</title>
  <style>
    body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000; }
    iframe { width: 100%; height: 100%; border: 0; }
  </style>
</head>
<body>
  <iframe 
    src="https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1&rel=0&showinfo=0&modestbranding=1" 
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
    allowfullscreen>
  </iframe>
</body>
</html>`;

      const htmlPath = path.join(hlsOutputPath, 'player.html');
      fs.writeFileSync(htmlPath, iframeHtml);
      
      // Instead of trying to create an HLS playlist that references the YouTube embed,
      // we'll create a simple HTML redirect that will open the player page directly
      // This avoids CORS issues with HLS.js trying to fetch YouTube content directly
      
      const redirectHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0;URL='${process.env.BACKEND_URL}/youtube-streams/${path.basename(outputDir)}/${videoId}/player.html'" />
  <title>Redirecting to YouTube Player</title>
</head>
<body>
  <p>Redirecting to player...</p>
</body>
</html>`;
      
      const redirectPath = path.join(hlsOutputPath, 'redirect.html');
      fs.writeFileSync(redirectPath, redirectHtml);
      
      console.log(`Created YouTube iframe player for: ${videoId}`);
      
      resolve({
        videoId,
        title: videoId, // Just use the ID as title
        hlsPath: redirectPath.replace(/\\/g, '/'),
        isProxy: true
      });
    } catch (error) {
      console.error('Error creating YouTube proxy:', error);
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