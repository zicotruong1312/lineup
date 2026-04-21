const { Events, MessageFlags } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        // Log loại tương tác để debug
        const type = interaction.isChatInputCommand() ? 'Slash Command' : 
                     interaction.isButton() ? 'Button' : 
                     interaction.isStringSelectMenu() ? 'Select Menu' : 'Other';
        
        console.log(`[Interaction] ${type} from ${interaction.user.tag} (${interaction.user.id})`);

        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`❌ Error executing ${interaction.commandName}:`);
                console.error(error);
                
                const errorMessage = { content: 'Đã có lỗi xảy ra khi thực thi lệnh này!', flags: [MessageFlags.Ephemeral] };
                
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            }
        } else if (interaction.isButton()) {
            // Button interactions are typically handled by collectors, 
            // but we log them here to ensure they reach the bot.
            console.log(`[Button Clicked] ID: ${interaction.customId} on message ${interaction.message.id}`);
        }
    },
};
