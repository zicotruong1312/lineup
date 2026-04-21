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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lineup')
        .setDescription('Tự động tìm kiếm vị trí Lineup cho các Agent (YouTube/TikTok)')
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

        await interaction.deferReply();

        let cache = await LineupCache.findOne({ searchQuery: query });
        let isUsingCache = true;

        if (!cache || cache.rejectedIndexes.length >= cache.results.length) {
            isUsingCache = false;
            await interaction.editReply(`🔎 **Đang tìm Lineup siêu tốc cho:** \`${rawQuery}\`...`);

            // Giai đoạn 1: Tìm YouTube trước vì nó nhanh nhất
            const ytResults = await searchYouTube(query);
            
            if (ytResults.length > 0) {
                // Có kết quả YT, hiển thị ngay lập tức
                const tempResults = [...ytResults];
                let tempIndex = 0;

                const renderStepMessage = async (index, searchingMore = true) => {
                    const video = tempResults[index];
                    const platformIcon = '▶️ YouTube';
                    let content = `🎯 **Lineup cho ${rawQuery.toUpperCase()}**\nNguồn: **${platformIcon}**\n${video.url}`;
                    if (searchingMore) content += '\n\n*(Drone vẫn đang quét thêm trên TikTok...)*';
                    
                    const btnAccept = new ButtonBuilder().setCustomId('accept').setLabel('✅ Chuẩn rồi').setStyle(ButtonStyle.Success);
                    const btnReject = new ButtonBuilder().setCustomId('reject').setLabel('❌ Báo lỗi/Kế tiếp').setStyle(ButtonStyle.Danger);
                    
                    return { 
                        content, 
                        components: [new ActionRowBuilder().addComponents(btnAccept, btnReject)] 
                    };
                };

                await interaction.editReply(await renderStepMessage(tempIndex, true));

                // Giai đoạn 2: Tìm TikTok ngầm
                const ttResults = await searchTikTok(query);
                
                // Trộn kết quả và tạo Cache
                const finalResults = [];
                const maxLength = Math.max(ytResults.length, ttResults.length);
                for (let i = 0; i < maxLength; i++) {
                    if (ttResults[i]) finalResults.push(ttResults[i]);
                    if (ytResults[i]) finalResults.push(ytResults[i]);
                }

                if (cache) await LineupCache.deleteOne({ _id: cache._id });
                cache = await LineupCache.create({
                    searchQuery: query,
                    results: finalResults,
                    rejectedIndexes: []
                });

                // Cập nhật lại UI bỏ dòng "đang tìm thêm"
                await interaction.editReply(await renderStepMessage(tempIndex, false));

            } else {
                // Nếu YouTube không có gì, phải đợi TikTok
                const ttResults = await searchTikTok(query);
                if (ttResults.length === 0) {
                    return interaction.editReply(`❌ Không tìm thấy Lineup nào cho \`${rawQuery}\` trên cả YT & TikTok!`);
                }

                if (cache) await LineupCache.deleteOne({ _id: cache._id });
                cache = await LineupCache.create({
                    searchQuery: query,
                    results: ttResults,
                    rejectedIndexes: []
                });
            }
        }

        // --- PHẦN COLLECTOR CHÍNH ---
        let currentIndex = 0;
        // Tìm video hợp lệ đầu tiên
        while (cache.rejectedIndexes.includes(currentIndex) && currentIndex < cache.results.length) {
            currentIndex++;
        }

        if (currentIndex >= cache.results.length) {
             return interaction.editReply(`❌ Tất cả video tìm được đều đã bị đánh dấu là sai.`);
        }

        const renderFinalMessage = async (index, isFinal = false) => {
            const video = cache.results[index];
            const platformIcon = video.platform === 'tiktok' ? '🎵 TikTok' : '▶️ YouTube';
            const messageObj = {
                content: `🎯 **Lineup cho ${rawQuery.toUpperCase()}** ${isUsingCache ? '(Cache ⚡)' : ''}\nNguồn: **${platformIcon}**\n${video.url}`
            };

            if (!isFinal) {
                const btnAccept = new ButtonBuilder().setCustomId('accept').setLabel('✅ Chuẩn rồi').setStyle(ButtonStyle.Success);
                const btnReject = new ButtonBuilder().setCustomId('reject').setLabel('❌ Báo lỗi/Kế tiếp').setStyle(ButtonStyle.Danger);
                messageObj.components = [new ActionRowBuilder().addComponents(btnAccept, btnReject)];
            } else {
                messageObj.components = [];
            }
            return messageObj;
        };

        // Hiển thị kết quả chính thức từ Cache (đã gộp YT/TT)
        await interaction.editReply(await renderFinalMessage(currentIndex));

        const responseMessage = await interaction.fetchReply();
        const collector = responseMessage.createMessageComponentCollector({ time: 5 * 60 * 1000 });

        collector.on('collect', async i => {
            try {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: '❌ Chỉ người dùng lệnh mới có thể phản hồi!', flags: [MessageFlags.Ephemeral] });
                }

                if (i.customId === 'accept') {
                    await i.update(await renderFinalMessage(currentIndex, true));
                    collector.stop('accepted');
                } else if (i.customId === 'reject') {
                    if (!cache.rejectedIndexes.includes(currentIndex)) {
                        cache.rejectedIndexes.push(currentIndex);
                        await cache.save();
                    }
                    currentIndex++;
                    while (cache.rejectedIndexes.includes(currentIndex) && currentIndex < cache.results.length) {
                        currentIndex++;
                    }

                    if (currentIndex >= cache.results.length) {
                        await i.update({ content: `❌ Hết sạch video trong kho dự trữ rồi.`, components: [] });
                        collector.stop('exhausted');
                    } else {
                        await i.update(await renderFinalMessage(currentIndex));
                    }
                }
            } catch (error) {
                console.error('❌ Collector error:', error);
            }
        });

        collector.on('end', async (collected, reason) => {
             if (reason === 'time') {
                 try { await interaction.editReply({ components: [] }); } catch (e) {}
             }
        });
    },
};
