const { google } = require('googleapis');

async function searchYouTube(query, agent = '', map = '', side = '', location = '') {
    if (!process.env.YOUTUBE_API_KEY) {
        console.warn('⚠️ Thiếu YOUTUBE_API_KEY trong file .env');
        return [];
    }

    const youtube = google.youtube({
        version: 'v3',
        auth: process.env.YOUTUBE_API_KEY
    });

    try {
        const cleanLocation = location ? location.split(' (')[0].toLowerCase() : '';
        const searchQuery = `"${agent}" "${map}" "${cleanLocation}" lineup valorant shorts`;

        const response = await youtube.search.list({
            part: 'snippet',
            q: searchQuery,
            type: 'video',
            videoDuration: 'short', 
            order: 'relevance', // Dùng relevance tốt hơn cho các truy vấn siêu chặt
            maxResults: 10 // Cần lấy nhiều hơn để lọt qua bộ lọc khắt khe
        });

        if (!response.data.items || response.data.items.length === 0) {
            return [];
        }

        const filtered = response.data.items.filter(item => {
            const title = item.snippet.title.toLowerCase();
            
            // 1. Kiểm tra Agent và Map
            if (agent && !title.includes(agent.toLowerCase())) return false;
            if (map && !title.includes(map.toLowerCase())) return false;

            // 2. Kiểm tra Location (VD: "b main")
            if (cleanLocation) {
                // Tách chữ (VD: 'A' và 'Site')
                const locParts = cleanLocation.split(' ');
                // Phải có ít nhất 1 phần của khu vực xuất hiện (tránh trường hợp title ghi A mờ nhạt, nhưng A Site thì thường có A)
                // Yêu cầu chặt chẽ: Thường title sẽ có "A" hoặc "B"
                const hasLocation = locParts.some(part => title.includes(part));
                if (!hasLocation) return false;
            }

            // 3. Kiểm tra Side (Rất khắt khe, nhưng video thường có keyword nới lỏng)
            if (side) {
                const isAttacker = side === 'attacker';
                const sideKeywords = isAttacker ? ['attack', 'post plant', 'tấn công', 'plant'] : ['defend', 'retake', 'phòng'];
                const hasSide = sideKeywords.some(kw => title.includes(kw));
                // Lưu ý: Rất nhiều video lineup không thèm ghi side. 
                // Nếu muốn áp dụng strict filter cho side thì bật dòng dưới, nhưng sẽ bị "Không tìm thấy" liên tục.
                // Để chiều ý người dùng, mình vẫn ráp vào:
                // if (!hasSide) return false; 
                // => Thay vì loại luôn, mình sẽ CHẤP NHẬN video nếu nó KHÔNG chứa keyword của phe ĐỐI LẬP (tránh nhầm lẫn).
                const oppositeKeywords = isAttacker ? ['defend', 'retake', 'phòng'] : ['attack', 'post plant', 'tấn công'];
                const isOpposite = oppositeKeywords.some(kw => title.includes(kw));
                if (isOpposite) return false; 
            }

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
