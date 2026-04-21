const { google } = require('googleapis');

async function searchTikTok(query, agent = '') {
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
            sort: 'date',
            num: 5 // Lấy nhiều hơn 1 chút để lọc
        });

        if (!response.data.items || response.data.items.length === 0) {
            return [];
        }

        const filtered = response.data.items.filter(item => {
            const title = item.title.toLowerCase();
            // Nếu có agent, bắt buộc title phải chứa tên agent đó
            if (agent && !title.includes(agent.toLowerCase())) return false;
            return true;
        });

        return filtered.map(item => ({
            videoId: item.link, 
            title: item.title,
            url: item.link,
            platform: 'tiktok',
            thumbnail: item.pagemap?.cse_image?.[0]?.src || null
        }));
    } catch (error) {
        if (error.message.includes('access to Custom Search JSON API')) {
            console.error('❌ TikTok Search: Custom Search API not enabled or access denied.');
        } else {
            console.error('❌ Lỗi gọi TikTok (Google CSE) API:', error.message);
        }
        return [];
    }
}

module.exports = { searchTikTok };
