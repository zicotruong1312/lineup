require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.commands = new Collection();

// Kết nối MongoDB
if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI missing in .env');
    process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB (Cache DB)'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// Load Commands
const commandsPath = path.join(__dirname, 'commands');
if (!fs.existsSync(commandsPath)) fs.mkdirSync(commandsPath, { recursive: true });

const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
const commands = [];

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
    } else {
        console.warn(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Load Events
const eventsPath = path.join(__dirname, 'events');
if (!fs.existsSync(eventsPath)) fs.mkdirSync(eventsPath, { recursive: true });

const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

// Push commands to Discord
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);
        if (commands.length > 0) {
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands },
            );
            console.log(`Successfully reloaded application (/) commands.`);
        }
    } catch (error) {
        console.error(error);
    }
})();

client.login(process.env.DISCORD_TOKEN);
