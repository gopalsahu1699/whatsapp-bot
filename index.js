const { Client, LocalAuth, RemoteAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { getAIResponse } = require('./ai');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const { startServer } = require('./server');

let client;

async function startBot() {
    console.log('Starting bot...');

    let authStrategy;

    if (process.env.MONGODB_URI) {
        console.log('Connecting to MongoDB for session storage...');
        try {
            await mongoose.connect(process.env.MONGODB_URI);
            const store = new MongoStore({ mongoose: mongoose });
            authStrategy = new RemoteAuth({
                clientId: 'whatsapp-bot',
                store: store,
                backupSyncIntervalMs: 300000
            });
            console.log('RemoteAuth strategy initialized.');
        } catch (err) {
            console.error('MongoDB connection failed, falling back to LocalAuth:', err);
            authStrategy = new LocalAuth();
        }
    } else {
        console.log('No MONGODB_URI found, using LocalAuth.');
        authStrategy = new LocalAuth();
    }

    // Detect local chrome installation on Render
    let executablePath = process.env.CHROME_PATH || undefined;
    if (!executablePath && (process.env.RENDER || process.env.NODE_ENV === 'production')) {
        const fs = require('fs');
        const path = require('path');
        const baseDir = path.join(__dirname, '.puppeteer-cache');

        console.log('Searching for Chrome in:', baseDir);

        function findChrome(dir) {
            if (!fs.existsSync(dir)) return null;
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const fullPath = path.join(dir, file);
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    const found = findChrome(fullPath);
                    if (found) return found;
                } else if (file === 'chrome' || file === 'google-chrome' || file === 'chrome.exe') {
                    // Check if it's the actual binary (not a script or directory)
                    if (fullPath.includes('chrome-linux') || fullPath.includes('chrome-linux64') || fullPath.includes('chrome-win') || fullPath.includes('chrome-win64')) {
                        return fullPath;
                    }
                }
            }
            return null;
        }

        executablePath = findChrome(baseDir);
        if (executablePath) {
            console.log('✅ Found Chrome executable at:', executablePath);
            // Ensure it's executable
            try { fs.chmodSync(executablePath, '755'); } catch (e) { }
        } else {
            console.error('❌ Could not find Chrome executable in .puppeteer-cache');
            // List contents of .puppeteer-cache for debugging
            try {
                const listDir = (d, indent = '') => {
                    if (!fs.existsSync(d)) return;
                    const files = fs.readdirSync(d);
                    files.forEach(f => {
                        console.log(`${indent}${f}`);
                        const p = path.join(d, f);
                        if (fs.statSync(p).isDirectory()) listDir(p, indent + '  ');
                    });
                };
                listDir(baseDir);
            } catch (e) { }
        }
    }

    // Initialize the client
    client = new Client({
        authStrategy: authStrategy,
        authTimeoutMs: 60000, // Increase timeout to 60s for slow connections
        qrMaxRetries: 5,
        puppeteer: {
            executablePath: executablePath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process', // Highly critical for low-memory environments
                '--disable-gpu',
                '--js-flags="--max-old-space-size=400"' // Limit browser JS memory to 400MB
            ],
            headless: true
        }
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

    client.on('remote_session_saved', () => {
        console.log('Session saved to remote storage');
    });

    // --- MESSAGE QUEUEING (One chat at a time) ---
    const chatQueues = new Map();

    async function processMessage(msg) {
        try {
            console.log(`PROCESSING MESSAGE: ${msg.body} from ${msg.from}`);

            // Ignore status updates/broadcasts
            if (msg.from === 'status@broadcast') {
                return;
            }

            const chat = await msg.getChat();

            // 1. "Reading" Delay (Simulate human reading time: 1-2 seconds)
            const readingDelay = Math.floor(Math.random() * 1000) + 1000;
            await new Promise(resolve => setTimeout(resolve, readingDelay));

            // 2. Start Typing (Indicator appears on WhatsApp)
            await chat.sendStateTyping();

            // --- COMMANDS ---

            if (msg.body === '!ping') {
                await msg.reply('pong');
                return;
            }

            if (msg.body === '!help') {
                await msg.reply(`*Bot Commands*\n\n` +
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
                        await client.sendMessage(msg.from, media, { sendMediaAsSticker: true });
                    } catch (err) {
                        console.error('Error creating sticker:', err);
                        await msg.reply('Error creating sticker.');
                    }
                } else {
                    await msg.reply('Please send an image or video with the caption !sticker');
                }
                return;
            }

            // 3. AI Response Generation (Typing continues during this time)
            const aiResponse = await getAIResponse(msg.body);

            // 4. "Thinking/Typing" Delay (Simulate typing speed based on message length)
            // Approx 0.05 - 0.1s per character
            const typingTime = Math.min(Math.max(aiResponse.length * 50, 2000), 7000);
            console.log(`Typing for ${typingTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, typingTime));

            // 5. Send the reply
            await msg.reply(aiResponse);

        } catch (error) {
            console.error('Error handling message:', error);
        }
    }

    // Listen for incoming messages
    client.on('message', async msg => {
        const chatId = msg.from;

        // Get existing queue for this chat or start a fresh one
        const previousTask = chatQueues.get(chatId) || Promise.resolve();

        // Chain the new message processing to the previous task
        const currentTask = previousTask
            .then(() => processMessage(msg))
            .catch(err => console.error(`Queue error for ${chatId}:`, err))
            .finally(() => {
                // Remove from map if this is still the latest task in queue
                if (chatQueues.get(chatId) === currentTask) {
                    chatQueues.delete(chatId);
                }
            });

        chatQueues.set(chatId, currentTask);
    });

    // Start the dashboard server
    startServer(client);

    // Initialize the client
    client.initialize();
}

startBot();

// Export function for potential future use (though we start it here)
module.exports = { getClient: () => client };
