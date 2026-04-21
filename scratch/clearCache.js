const mongoose = require('mongoose');
require('dotenv').config();
const LineupCache = require('../src/models/LineupCache');

async function clearCache() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected. Clearing LineupCache collection...');
        const result = await LineupCache.deleteMany({});
        console.log(`Successfully cleared ${result.deletedCount} cached lineups.`);
        process.exit(0);
    } catch (error) {
        console.error('Error clearing cache:', error);
        process.exit(1);
    }
}

clearCache();
