const mongoose = require('mongoose');

const lineupCacheSchema = new mongoose.Schema({
    searchQuery: {
        type: String,
        required: true,
        unique: true, // VD: "sova ascent attacker b main"
    },
    results: [{
        videoId: String,       
        title: String,
        url: String,
        platform: {
            type: String,
            enum: ['youtube', 'tiktok']
        },      
        thumbnail: String,
    }],
    rejectedIndexes: {
        type: [Number],
        default: []
    },
    lastUpdated: {
        type: Date,
        default: Date.now,
        expires: 30 * 24 * 60 * 60 // Tự động dọn dẹp cache cũ sau 30 ngày để tiết kiệm dung lượng
    }
});

module.exports = mongoose.model('LineupCache', lineupCacheSchema);
