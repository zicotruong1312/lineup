const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`Error executing ${interaction.commandName}`);
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Đã có lỗi xảy ra khi thực thi lệnh này!', flags: ['Ephemeral'] });
            } else {
                await interaction.reply({ content: 'Đã có lỗi xảy ra khi thực thi lệnh này!', flags: ['Ephemeral'] });
            }
        }
    },
};
