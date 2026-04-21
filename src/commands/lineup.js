const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const LineupCache = require('../models/LineupCache');
const { searchYouTube } = require('../services/youtubeSearch');
const { searchTikTok } = require('../services/tiktokSearch');

const AGENTS = [
    'Viper', 'Sova', 'Brimstone', 'Killjoy', 'Cypher', 'Fade', 'Gekko', 'Harbor', 
    'KAY/O', 'Raze', 'Sage', 'Astra', 'Breach', 'Chamber', 'Clove', 'Vyse', 
    'Veto', 'Miks', 'Deadlock', 'Iso', 'Jett', 'Neon', 'Omen', 'Phoenix', 
    'Reyna', 'Skye', 'Yoru'
].sort();

const MAPS = [
    'Abyss', 'Ascent', 'Bind', 'Breeze', 'Corrode', 'Fracture', 'Haven', 
    'Icebox', 'Lotus', 'Pearl', 'Split', 'Sunset'
].sort();

const LOCATIONS_MAP = {
    'Ascent': ['A Site', 'B Site', 'A Main', 'B Main', 'Mid Bottom', 'Market', 'Pizza', 'Hẻm (Alley)'],
    'Bind': ['A Site (Nghĩa địa)', 'B Site (Default)', 'A Bath (Trụ)', 'A Lamp', 'B Long', 'Hookah', 'Cổng dịch chuyển'],
    'Breeze': ['A Site', 'B Site', 'A Cave', 'Mid Nest', 'Mid Wood', 'B Back', 'Cầu (Bridge)'],
    'Haven': ['A Site', 'B Site', 'C Site', 'A Long', 'A Short', 'C Long', 'Garage', 'Garden'],
    'Icebox': ['A Site', 'B Site', 'B Yellow', 'A Pipes', 'Mid Kitchen', 'Snowman', 'B Tu-nen'],
    'Split': ['A Site', 'B Site', 'A Main', 'B Main', 'A Ramp', 'Mid Mail', 'B Heaven'],
    'Lotus': ['A Site', 'B Site', 'C Site', 'A Rubble', 'B Main', 'C Main', 'A Link', 'Rotating Door'],
    'Pearl': ['A Site', 'B Site', 'B Long', 'A Main', 'Mid Art', 'Secret', 'Restaurant'],
    'Sunset': ['A Site', 'B Site', 'A Elbow', 'B Market', 'Mid Courtyard', 'Bobas', 'Top Mid'],
    'Fracture': ['A Site', 'B Site', 'A Dish', 'B Arcade', 'B Under', 'Cầu (Bridge)', 'A Drop'],
    'Abyss': ['A Site', 'B Site', 'Mid Library', 'A Bridge', 'B Danger', 'Circus', 'Catwalk'],
    'Corrode': ['A Site', 'B Site', 'Mid', 'A Main', 'B Main', 'Center', 'Tower']
};

// Bộ nhớ đệm RAM để phản hồi 1-2s cho các tìm kiếm lặp lại
const RAM_CACHE = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lineup')
        .setDescription('Tự động tìm kiếm vị trí Lineup cho các Agent')
        .addStringOption(option =>
            option.setName('agent')
                .setDescription('Tên Agent (Vd: Sova, Viper,...)')
                .setRequired(true)
                .setAutocomplete(true))
        .addStringOption(option =>
            option.setName('map')
                .setDescription('Tên bản đồ (Vd: Ascent, Bind,...)')
                .setRequired(true)
                .setAutocomplete(true))
        .addStringOption(option =>
            option.setName('side')
                .setDescription('Phe (Tấn công hay Phòng thủ)')
                .setRequired(true)
                .addChoices(
                    { name: 'Khởi đầu (Attacker)', value: 'attacker' },
                    { name: 'Phòng ngự (Defender)', value: 'defender' }
                ))
        .addStringOption(option =>
            option.setName('location')
                .setDescription('Vị trí cần ném (Vd: B Main, A Site,...)')
                .setRequired(true)
                .setAutocomplete(true)),

    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        let choices = [];

        if (focusedOption.name === 'agent') {
            choices = AGENTS;
        } else if (focusedOption.name === 'map') {
            choices = MAPS;
        } else if (focusedOption.name === 'location') {
            const mapValue = interaction.options.getString('map');
            if (mapValue && LOCATIONS_MAP[mapValue]) {
                choices = LOCATIONS_MAP[mapValue];
            } else {
                choices = ['A Site', 'B Site', 'Mid', 'A Main', 'B Main'];
            }
        }

        const filtered = choices.filter(choice => 
            choice.toLowerCase().includes(focusedOption.value.toLowerCase())
        ).slice(0, 25);

        await interaction.respond(
            filtered.map(choice => ({ name: choice, value: choice }))
        );
    },

    async execute(interaction) {
        const agent = interaction.options.getString('agent');
        const map = interaction.options.getString('map');
        const side = interaction.options.getString('side');
        const location = interaction.options.getString('location');

        const rawQuery = `${agent} ${map} ${side} ${location}`;
        const query = rawQuery.toLowerCase().replace(/\s+/g, ' ').trim();

        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        // 1. Kiểm tra RAM Cache (Siêu nhanh 1-2s)
        if (RAM_CACHE.has(query)) {
            const cacheData = RAM_CACHE.get(query);
            await interaction.editReply(await this.renderFinalMessage(query, cacheData, 0, true));
            return this.setupCollector(interaction, query, true);
        }

        // 2. Kiểm tra Database Cache
        let dbCache = await LineupCache.findOne({ searchQuery: query });
        if (dbCache && dbCache.rejectedIndexes.length < dbCache.results.length) {
            RAM_CACHE.set(query, dbCache);
            await interaction.editReply(await this.renderFinalMessage(query, dbCache, 0, true));
            return this.setupCollector(interaction, query, true);
        }

        // 3. Nếu không có cache, tiến hành tìm kiếm mới
        await interaction.editReply(`🔎 **Đang tìm Lineup chuẩn cho ${agent} tại ${map}...**`);

        // Giai đoạn 1: YouTube (Ưu tiên tốc độ)
        const ytResults = await searchYouTube(query, agent, map);
        
        let currentCache = null;

        if (ytResults.length > 0) {
            // Hiện YT ngay
            const tempResults = [...ytResults];
            let tempIndex = 0;

            const renderStepMessage = async (index, searchingMore = true) => {
                const video = tempResults[index];
                let content = `🎯 **Lineup cho ${rawQuery.toUpperCase()}**\nNguồn: **▶️ YouTube**\n${video.url}`;
                if (searchingMore) content += '\n\n*(Đang quét thêm video phong cách TikTok để có nhiều lựa chọn hơn...)*';
                
                const btnAccept = new ButtonBuilder().setCustomId('accept').setLabel('✅ Chuẩn rồi').setStyle(ButtonStyle.Success);
                const btnReject = new ButtonBuilder().setCustomId('reject').setLabel('❌ Báo lỗi/Kế tiếp').setStyle(ButtonStyle.Danger);
                
                return { content, components: [new ActionRowBuilder().addComponents(btnAccept, btnReject)] };
            };

            await interaction.editReply(await renderStepMessage(tempIndex, true));

            // Giai đoạn 2: TikTok (Thông qua YouTube Shorts) ngầm
            const ttResults = await searchTikTok(query, agent, map);
            
            const finalResults = [];
            const maxLength = Math.max(ytResults.length, ttResults.length);
            for (let i = 0; i < maxLength; i++) {
                if (ttResults[i]) finalResults.push(ttResults[i]);
                if (ytResults[i]) finalResults.push(ytResults[i]);
            }

            if (dbCache) await LineupCache.deleteOne({ _id: dbCache._id });
            currentCache = await LineupCache.create({
                searchQuery: query,
                results: finalResults,
                rejectedIndexes: []
            });

            RAM_CACHE.set(query, currentCache);
            await interaction.editReply(await renderStepMessage(tempIndex, false));

        } else {
            // Đợi TikTok nếu YT không có (hiếm khi xảy ra vì đều dùng YT now)
            const ttResults = await searchTikTok(query, agent, map);
            if (ttResults.length === 0) {
                return interaction.editReply(`❌ Không tìm thấy Lineup nào của **${agent}** tại bản đồ **${map}** cho vị trí này!`);
            }

            if (dbCache) await LineupCache.deleteOne({ _id: dbCache._id });
            currentCache = await LineupCache.create({
                searchQuery: query,
                results: ttResults,
                rejectedIndexes: []
            });
            RAM_CACHE.set(query, currentCache);
        }

        // --- PHẦN COLLECTOR GỐC ---
        let currentIndex = 0;
        // Tìm video hợp lệ đầu tiên
        while (currentCache.rejectedIndexes.includes(currentIndex) && currentIndex < currentCache.results.length) {
            currentIndex++;
        }

        if (currentIndex >= currentCache.results.length) {
             return interaction.editReply(`❌ Tất cả video tìm được đều đã bị đánh dấu là sai.`);
        }

        await interaction.editReply(await this.renderFinalMessage(query, currentCache, currentIndex));
        this.setupCollector(interaction, query, false);
    },

    async renderFinalMessage(query, cache, index, isFromCache = false) {
        if (!cache || !cache.results || cache.results.length === 0) {
             return { content: `❌ Dữ liệu trống.` };
        }
        const video = cache.results[index];
        if (!video) return { content: `❌ Không còn video hợp lệ.` };

        const platformIcon = video.platform === 'tiktok' ? '🎵 TikTok' : '▶️ YouTube';
        const messageObj = {
            content: `🎯 **Lineup cho ${query.toUpperCase()}** ${isFromCache ? '(⚡ Tải từ RAM)' : ''}\nNguồn: **${platformIcon}**\n${video.url}`
        };

        const btnAccept = new ButtonBuilder().setCustomId('accept').setLabel('✅ Chuẩn rồi').setStyle(ButtonStyle.Success);
        const btnReject = new ButtonBuilder().setCustomId('reject').setLabel('❌ Báo lỗi/Kế tiếp').setStyle(ButtonStyle.Danger);
        messageObj.components = [new ActionRowBuilder().addComponents(btnAccept, btnReject)];

        return messageObj;
    },

    async setupCollector(interaction, query, isFromCache = false) {
        const responseMessage = await interaction.fetchReply();
        const collector = responseMessage.createMessageComponentCollector({ time: 5 * 60 * 1000 });

        collector.on('collect', async i => {
            try {
                if (i.user.id !== interaction.user.id) return i.reply({ content: '❌ Không dành cho bạn!', flags: [MessageFlags.Ephemeral] });
                
                let cache = RAM_CACHE.get(query);
                if (!cache) {
                    cache = await LineupCache.findOne({ searchQuery: query });
                }

                if (!cache) {
                    return i.reply({ content: '❌ Lỗi: Không tìm thấy cache.', flags: [MessageFlags.Ephemeral] });
                }

                let currentIndex = 0;
                // Tìm index hiện tại dựa vào URL từ nội dung tin nhắn hiện tại
                currentIndex = cache.results.findIndex(v => i.message.content.includes(v.url));
                if (currentIndex === -1) currentIndex = 0;

                if (i.customId === 'accept') {
                    const finalMsg = await this.renderFinalMessage(query, cache, currentIndex, isFromCache);
                    finalMsg.components = []; // Bỏ nút
                    await i.update(finalMsg);
                    collector.stop('accepted');
                } else if (i.customId === 'reject') {
                    if (!cache.rejectedIndexes.includes(currentIndex)) {
                        cache.rejectedIndexes.push(currentIndex);
                        // Update cache in memory and DB
                        RAM_CACHE.set(query, cache);
                        await LineupCache.updateOne({ searchQuery: query }, { rejectedIndexes: cache.rejectedIndexes });
                    }
                    currentIndex++;
                    while (cache.rejectedIndexes.includes(currentIndex) && currentIndex < cache.results.length) { currentIndex++; }

                    if (currentIndex >= cache.results.length) {
                        await i.update({ content: `❌ Hết sạch video chuẩn cho vị trí này rồi!`, components: [] });
                        collector.stop('exhausted');
                    } else {
                        await i.update(await this.renderFinalMessage(query, cache, currentIndex, isFromCache));
                    }
                }
            } catch (error) { console.error('❌ Collector error:', error); }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                try { await interaction.editReply({ components: [] }); } catch (e) {}
            }
       });
    }
};
