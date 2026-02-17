const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { getAIResponse } = require('./ai');

// Initialize the client with LocalAuth to save the session
const client = new Client({
    authStrategy: new LocalAuth()
});

// Generate QR code for authentication
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('Scan the QR code above with your WhatsApp app.');
});

// Log when the client fails to authenticate
client.on('auth_failure', msg => {
    console.error('AUTHENTICATION FAILURE', msg);
});

// Log when the client is ready
client.on('ready', () => {
    console.log('Client is ready!');
});

// Listen for incoming messages
client.on('message', async msg => {
    try {
        console.log(`MESSAGE RECEIVED: ${msg.body} from ${msg.from}`);

        // Ignore status updates/broadcasts
        if (msg.from === 'status@broadcast') {
            return;
        }

        const chat = await msg.getChat();

        // Simulate typing
        await chat.sendStateTyping();

        // Random delay between 2 and 5 seconds (Anti-ban measure)
        const delay = Math.floor(Math.random() * (5000 - 2000 + 1) + 2000);
        console.log(`Waiting for ${delay}ms before replying...`);

        await new Promise(resolve => setTimeout(resolve, delay));

        // Clear typing state
        await chat.clearState();

        // --- COMMANDS ---

        if (msg.body === '!ping') {
            msg.reply('pong');
            return;
        }

        if (msg.body === '!help') {
            msg.reply(`*Bot Commands*\n\n` +
                `!ping - Check if bot is alive\n` +
                `!help - Show this menu\n` +
                `!sticker - Reply to an image/video to make a sticker\n` +
                `\n*Ask me anything about our business!*`);
            return;
        }

        if (msg.body === '!sticker') {
            if (msg.hasMedia) {
                try {
                    const media = await msg.downloadMedia();
                    client.sendMessage(msg.from, media, { sendMediaAsSticker: true });
                } catch (err) {
                    console.error('Error creating sticker:', err);
                    msg.reply('Error creating sticker.');
                }
            } else {
                msg.reply('Please send an image or video with the caption !sticker');
            }
            return;
        }

        // --- AI RESPONSE ---

        // If it's not a command, use AI
        const aiResponse = await getAIResponse(msg.body);
        msg.reply(aiResponse);

    } catch (error) {
        console.error('Error handling message:', error);
    }
});

// Initialize the client
client.initialize();

// Start the dashboard server
const { startServer } = require('./server');
startServer(client);

// Export client for external use
module.exports = { client };
