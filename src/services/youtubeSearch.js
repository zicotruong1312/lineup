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
            q: `"${agent}" ${map} lineup valorant shorts`,
            type: 'video',
            videoDuration: 'short', 
            order: 'date',
            maxResults: 5 // Lấy nhiều hơn một chút để lọc
        });

        if (!response.data.items || response.data.items.length === 0) {
            return [];
        }

        const filtered = response.data.items.filter(item => {
            const title = item.snippet.title.toLowerCase();
            // Nếu có agent, bắt buộc title phải chứa tên agent đó
            if (agent && !title.includes(agent.toLowerCase())) return false;
            return true;
        });

        return filtered.map(item => ({
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
