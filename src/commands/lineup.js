const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const LineupCache = require('../models/LineupCache');
const { searchYouTube } = require('../services/youtubeSearch');
const { searchTikTok } = require('../services/tiktokSearch');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lineup')
        .setDescription('Tự động tìm kiếm vị trí Lineup cho các Agent (YouTube/TikTok)')
        .addStringOption(option =>
            option.setName('agent')
                .setDescription('Tên Agent (Vd: Sova, Viper, Killjoy,...)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('map')
                .setDescription('Tên bản đồ (Vd: Ascent, Bind, Split,...)')
                .setRequired(true))
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
                .setDescription('Vị trí cần ném (Vd: B Main, A Site, Mid...)')
                .setRequired(true)),
                
    async execute(interaction) {
        const agent = interaction.options.getString('agent');
        const map = interaction.options.getString('map');
        const side = interaction.options.getString('side');
        const location = interaction.options.getString('location');

        // Chuẩn hóa từ khóa tìm kiếm
        const rawQuery = `${agent} ${map} ${side} ${location}`;
        const query = rawQuery.toLowerCase().replace(/\s+/g, ' ').trim();

        await interaction.deferReply(); // Phản hồi tạm tránh timeout

        let cache = await LineupCache.findOne({ searchQuery: query });
        let isUsingCache = true;

        // Nếu chưa có Cache hoặc tất cả kết quả cũ đã bị báo lỗi hết
        if (!cache || cache.rejectedIndexes.length >= cache.results.length) {
            isUsingCache = false;
            await interaction.editReply(`🤖 **Đang dùng drone quét dữ liệu từ YouTube & TikTok cho:** \`${rawQuery}\`...`);

            // Chạy ngầm 2 cỗ máy tìm kiếm song song lấy mỗi bên 5 kết quả
            const [ytResults, ttResults] = await Promise.all([
                searchYouTube(query),
                searchTikTok(query)
            ]);

            // Trộn xen kẽ kết quả (1 YT, 1 TT, 1 YT...)
            const combinedResults = [];
            const maxLength = Math.max(ytResults.length, ttResults.length);
            for (let i = 0; i < maxLength; i++) {
                if (ttResults[i]) combinedResults.push(ttResults[i]); // Ưu tiên Tiktok trước như đã nói
                if (ytResults[i]) combinedResults.push(ytResults[i]);
            }

            if (combinedResults.length === 0) {
                return interaction.editReply(`❌ Không tìm thấy Lineup nào cho \`${rawQuery}\` trên mạng! Thử dùng từ khóa dễ hiểu hơn xem sao.`);
            }

            // Xóa cache cũ nếu tồn tại nhung hết sạch video để lưu mới lại từ đầu
            if (cache) {
                 await LineupCache.deleteOne({ _id: cache._id });
            }

            cache = await LineupCache.create({
                searchQuery: query,
                results: combinedResults,
                rejectedIndexes: []
            });
        }

        // Tìm video hợp lệ đầu tiên (chưa bị vote ❌)
        let currentIndex = 0;
        while (cache.rejectedIndexes.includes(currentIndex) && currentIndex < cache.results.length) {
            currentIndex++;
        }

        if (currentIndex >= cache.results.length) {
             return interaction.editReply(`❌ Tất cả video tìm được đều đã bị đánh dấu là sai. Xin hãy thử lại với một vị trí khác.`);
        }

        // Hàm helper để render thông điệp kèm Nút
        const renderMessage = async (index, isFinal = false) => {
            const video = cache.results[index];
            const platformIcon = video.platform === 'tiktok' ? '🎵 TikTok' : '▶️ YouTube';
            
            const messageObj = {
                content: `🎯 **Lineup cho ${rawQuery.toUpperCase()}** ${isUsingCache ? '(Tải từ Cache ⚡)' : ''}\nNguồn: **${platformIcon}**\n${video.url}`
            };

            if (!isFinal) {
                const btnAccept = new ButtonBuilder()
                    .setCustomId('accept')
                    .setLabel('✅ Chuẩn rồi')
                    .setStyle(ButtonStyle.Success);
                const btnReject = new ButtonBuilder()
                    .setCustomId('reject')
                    .setLabel('❌ Báo lỗi/Tìm tiếp')
                    .setStyle(ButtonStyle.Danger);
                
                messageObj.components = [new ActionRowBuilder().addComponents(btnAccept, btnReject)];
            } else {
                messageObj.components = []; // Xóa menu buttons sau khi người dùng chốt
            }

            return messageObj;
        };

        const responseMessage = await interaction.editReply(await renderMessage(currentIndex));

        // Khởi tạo Collector nốt nghe các Button (hiệu lực trong 5 phút)
        const collector = responseMessage.createMessageComponentCollector({ time: 5 * 60 * 1000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: '❌ Chỉ người dùng lệnh mới có thể phản hồi nút bấm này!', flags: ['Ephemeral'] });
            } // (DiscordJS v14.15+ dùng flags: ['Ephemeral']. Cũ hơn dùng ephemeral: true. Do là mới cào v14 default nên flags là an toàn)

            if (i.customId === 'accept') {
                // Người dùng xác nhận đúng, dừng collector, update message xóa nút
                await i.update(await renderMessage(currentIndex, true));
                collector.stop('accepted');
            } else if (i.customId === 'reject') {
                // Báo sai -> Đẩy index này vào bị loại
                if (!cache.rejectedIndexes.includes(currentIndex)) {
                    cache.rejectedIndexes.push(currentIndex);
                    await cache.save();
                }

                // Nhảy sang video kế tiếp hợp lệ
                currentIndex++;
                while (cache.rejectedIndexes.includes(currentIndex) && currentIndex < cache.results.length) {
                    currentIndex++;
                }

                if (currentIndex >= cache.results.length) {
                    await i.update({
                        content: `❌ Hết sạch video trong kho dự trữ rồi. Có vẻ hệ thống vẫn chưa đủ thông minh với vị trí này...`,
                        components: []
                    });
                    collector.stop('exhausted');
                } else {
                    isUsingCache = true; // Chuyển nhảy tab trong cache được xem là call từ bộ nhớ
                    await i.update(await renderMessage(currentIndex));
                }
            }
        });

        collector.on('end', async (collected, reason) => {
             if (reason === 'time') {
                 // Nếu hết thời gian 5 phút mà không ai ấn, tự động xoá cái buttons để dọn rác giao diện
                 try {
                     await interaction.editReply({ components: [] });
                 } catch (e) {
                     // Bỏ qua lỗi nếu message gốc đã bị xoá
                 }
             }
        });
    },
};
