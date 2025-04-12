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

// Add error handling for cases where YouTube videos are not available
// This function should check if a video ID is still available on YouTube
const checkYouTubeVideo = async (videoId) => {
  try {
    const info = await ytdl.getInfo(videoId);
    return {
      valid: true,
      info
    };
  } catch (error) {
    console.error(`YouTube video check failed for ${videoId}:`, error.message);
    return {
      valid: false,
      error: error.message
    };
  }
};

// Update the downloadVideo function to handle errors better
async function downloadVideo(videoId, outputDir) {
  try {
    // Check if video is available
    const videoCheck = await checkYouTubeVideo(videoId);
    if (!videoCheck.valid) {
      throw new Error(`YouTube video ${videoId} is not available: ${videoCheck.error}`);
    }
    
    // Create html files even if download fails
    const playerPath = path.join(outputDir, `${videoId}_player.html`);
    const redirectPath = path.join(outputDir, `${videoId}_redirect.html`);
    
    // Create a simple redirect HTML
    const redirectHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta http-equiv="refresh" content="0;url=${playerPath}" />
    </head>
    <body>
      <p>Redirecting to player...</p>
    </body>
    </html>`;
    
    // Create a simple player HTML that can be embedded in iframes
    const playerHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>YouTube Player</title>
      <style>
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000; }
        iframe { width: 100%; height: 100%; border: none; }
      </style>
    </head>
    <body>
      <iframe 
        src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&controls=1&rel=0" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen>
      </iframe>
    </body>
    </html>`;
    
    // Write the HTML files
    fs.writeFileSync(redirectPath, redirectHtml);
    fs.writeFileSync(playerPath, playerHtml);
    
    // Return paths that can be used by the frontend
    return {
      redirectPath: redirectPath,
      playerPath: playerPath,
      hlsPath: redirectPath, // This will be used for HLS requests
      status: 'ready'
    };
  } catch (error) {
    console.error(`Error downloading YouTube video ${videoId}:`, error);
    
    // Create a fallback HTML that shows an error and offers an alternative
    const errorPath = path.join(outputDir, `${videoId}_error.html`);
    const errorHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Video Unavailable</title>
      <style>
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000; color: #fff; font-family: Arial, sans-serif; }
        .container { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; }
        h1 { font-size: 24px; margin-bottom: 20px; }
        p { font-size: 16px; margin-bottom: 30px; max-width: 80%; text-align: center; }
        iframe { width: 100%; height: 50%; border: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Video Unavailable</h1>
        <p>The requested video is no longer available on YouTube. We're showing you an alternative video instead.</p>
        <iframe 
          src="https://www.youtube.com/embed/videoseries?list=PLRz-wq-Mubhl_-iHBPHB91LCQWFJMVeOR&autoplay=1&mute=0&controls=1&rel=0" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowfullscreen>
        </iframe>
      </div>
    </body>
    </html>`;
    
    fs.writeFileSync(errorPath, errorHtml);
    
    // Return the error page path
    return {
      redirectPath: errorPath,
      playerPath: errorPath,
      hlsPath: errorPath,
      status: 'error',
      error: error.message
    };
  }
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