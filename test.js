require('dotenv').config();
const mongoose = require('mongoose');
const { searchYouTube } = require('./src/services/youtubeSearch');
const { searchTikTok } = require('./src/services/tiktokSearch');
const LineupCache = require('./src/models/LineupCache');

async function runTest() {
    console.log('⏳ Bước 1: Kết nối MongoDB...');
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB kết nối thành công!');
    } catch (e) {
        console.error('❌ Lỗi kết nối MongoDB:', e.message);
        process.exit(1);
    }

    const query = "sova ascent attacker b main";
    console.log(`\n⏳ Bước 2: Thử nghiệm lệnh Tìm kiếm cho từ khóa: "${query}"...`);
    console.log('Đang gọi YouTube & TikTok API...');

    const [ytResults, ttResults] = await Promise.all([
        searchYouTube(query),
        searchTikTok(query)
    ]);

    console.log(`\n📊 KẾT QUẢ API TRẢ VỀ:
- YouTube tìm thấy: ${ytResults.length} video.
- TikTok (Google Custom Search) tìm thấy: ${ttResults.length} video.`);

    const combinedResults = [];
    const maxLength = Math.max(ytResults.length, ttResults.length);
    for (let i = 0; i < maxLength; i++) {
        if (ttResults[i]) combinedResults.push(ttResults[i]);
        if (ytResults[i]) combinedResults.push(ytResults[i]);
    }

    if (combinedResults.length > 0) {
        console.log('\n✅ Dữ liệu trộn (Interleaved) hoàn hảo. Video đầu tiên là:');
        console.log(`Tiêu đề: ${combinedResults[0].title}`);
        console.log(`Nền tảng: ${combinedResults[0].platform}`);
        console.log(`URL: ${combinedResults[0].url}`);
    } else {
        console.log('\n❌ Không có video nào được trả về, bạn hãy kiểm tra lại API keys rỗng hay lỗi Quota!');
    }

    console.log('\n⏳ Bước 3: Thử lưu vào Database (LineupCache)...');
    try {
        await LineupCache.deleteMany({ searchQuery: query }); // dọn đường
        const cache = await LineupCache.create({
            searchQuery: query,
            results: combinedResults,
            rejectedIndexes: []
        });
        console.log(`✅ Đã lưu Cache thành công với ID: ${cache._id}`);
        console.log(`✅ Toàn bộ luồng Logic: CHUẨN XÁC!`);
    } catch(e) {
         console.error('❌ Lỗi khi lưu Cache:', e.message);
    }

    mongoose.connection.close();
    console.log('\nKết thúc bài kiểm tra API & DB.');
}

runTest();
