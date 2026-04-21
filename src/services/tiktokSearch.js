const { google } = require('googleapis');

// YouTube client (tái sử dụng cấu hình giống youtubeSearch)
const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY
});

async function searchTikTok(query, agent = '', map = '') {
    if (!process.env.YOUTUBE_API_KEY) {
        console.warn('⚠️ Thiếu YOUTUBE_API_KEY. Không thể chạy Phương án A cho TikTok.');
        return [];
    }

    try {
        // Phương án A: Tìm TikTok re-up trên YouTube Shorts
        const response = await youtube.search.list({
            part: 'snippet',
            q: `"${agent}" "${map}" ${query} tiktok lineup valorant shorts`,
            type: 'video',
            videoDuration: 'short', 
            order: 'relevance', // Đổi sang relevance để lấy kết quả sát hơn thay vì chỉ mới nhất
            maxResults: 7 
        });

        if (!response.data.items || response.data.items.length === 0) {
            return [];
        }

        const filtered = response.data.items.filter(item => {
            const title = item.snippet.title.toLowerCase();
            // Bắt buộc title phải chứa tên agent và map đó
            if (agent && !title.includes(agent.toLowerCase())) return false;
            if (map && !title.includes(map.toLowerCase())) return false;
            return true;
        });

        return filtered.map(item => ({
            videoId: item.id.videoId,
            title: item.snippet.title,
            url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
            platform: 'tiktok', // Gắn mác TikTok để bot vẫn hiển thị như cũ
            thumbnail: item.snippet.thumbnails.high.url
        }));
    } catch (error) {
        console.error('❌ Lỗi TikTok (Phương án A qua YouTube Shorts):', error.message);
        return [];
    }
}

module.exports = { searchTikTok };
