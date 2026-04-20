const { google } = require('googleapis');

async function searchTikTok(query) {
    if (!process.env.GOOGLE_API_KEY || !process.env.GOOGLE_CX) {
        console.warn('⚠️ Thiếu GOOGLE_API_KEY hoặc GOOGLE_CX trong file .env');
        return [];
    }

    const customsearch = google.customsearch('v1');

    try {
        const response = await customsearch.cse.list({
            cx: process.env.GOOGLE_CX,
            q: query + ' lineup valorant',
            auth: process.env.GOOGLE_API_KEY,
            num: 5, // Lấy 5 kết quả đầu tiên
        });

        if (!response.data.items || response.data.items.length === 0) {
            return [];
        }

        return response.data.items.map(item => ({
            videoId: item.link, 
            title: item.title,
            url: item.link,
            platform: 'tiktok',
            thumbnail: item.pagemap?.cse_image?.[0]?.src || null
        }));
    } catch (error) {
        console.error('❌ Lỗi gọi TikTok (Google CSE) API:', error.message);
        return [];
    }
}

module.exports = { searchTikTok };
