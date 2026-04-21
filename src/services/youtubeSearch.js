const { google } = require('googleapis');

async function searchYouTube(query) {
    if (!process.env.YOUTUBE_API_KEY) {
        console.warn('⚠️ Thiếu YOUTUBE_API_KEY trong file .env');
        return [];
    }

    const youtube = google.youtube({
        version: 'v3',
        auth: process.env.YOUTUBE_API_KEY
    });

    try {
        const response = await youtube.search.list({
            part: 'snippet',
            q: query + ' lineup valorant shorts',
            type: 'video',
            videoDuration: 'short', 
            order: 'date',
            maxResults: 5
        });

        if (!response.data.items || response.data.items.length === 0) {
            return [];
        }

        return response.data.items.map(item => ({
            videoId: item.id.videoId,
            title: item.snippet.title,
            url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
            platform: 'youtube',
            thumbnail: item.snippet.thumbnails.high.url
        }));
    } catch (error) {
        console.error('❌ Lỗi gọi YouTube API:', error.message);
        return [];
    }
}

module.exports = { searchYouTube };
