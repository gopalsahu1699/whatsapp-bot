require('dotenv').config();
const { Client, LocalAuth, RemoteAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { getAIResponse } = require('./ai');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const { startServer } = require('./server');

let client;
let isInitializing = false;

// Initialize the client
function createClient(executablePath, authStrategy) {
    return new Client({
        authStrategy: authStrategy,
        authTimeoutMs: 60000,
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
                '--single-process',
                '--disable-gpu',
                '--no-default-browser-check',
                '--disable-extensions',
                '--js-flags="--max-old-space-size=400"'
            ],
            headless: true
        }
    });
}

async function startBot() {
    if (isInitializing) return;
    isInitializing = true;

    console.log('Starting bot...');

    let authStrategy;
    if (process.env.MONGODB_URI) {
        console.log('Connecting to MongoDB for session storage...');
        try {
            if (mongoose.connection.readyState === 0) {
                await mongoose.connect(process.env.MONGODB_URI);
            }
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

    let executablePath = process.env.CHROME_PATH || undefined;
    if (!executablePath && (process.env.RAILWAY_ENVIRONMENT || process.env.RENDER || process.env.NODE_ENV === 'production' || process.env.PORT)) {
        const fs = require('fs');
        const path = require('path');
        const baseDir = path.join(__dirname, '.puppeteer-cache');

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
                    if (fullPath.includes('chrome-linux') || fullPath.includes('chrome-linux64') || fullPath.includes('chrome-win') || fullPath.includes('chrome-win64')) {
                        return fullPath;
                    }
                }
            }
            return null;
        }

        executablePath = findChrome(baseDir);
    }

    client = createClient(executablePath, authStrategy);

    // --- Events ---
    client.on('qr', (qr) => {
        qrcode.generate(qr, { small: true });
        console.log('\n--- WHATSAPP QR CODE ---');
        console.log('1. Scan the QR code above in your terminal (if it looks okay)');
        console.log('2. OR scan it via the Dashboard for better visibility:');
        const dashboardUrl = process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : `http://localhost:${process.env.PORT || 3000}`;
        console.log(`👉 Dashboard URL: ${dashboardUrl}`);
        console.log('------------------------\n');
    });

    client.on('authenticated', () => {
        console.log('WhatsApp Authenticated');
    });

    client.on('auth_failure', msg => {
        console.error('AUTHENTICATION FAILURE', msg);
    });

    client.on('ready', () => {
        console.log('Client is ready!');
        if (client.info && client.info.wid) {
            console.log('Connected as:', client.info.wid._serialized);
        }
    });

    client.on('disconnected', async (reason) => {
        console.log('Client was logged out', reason);
        // Do not auto-restart here to avoid infinite loops, let the dashboard handle it
    });

    // --- MESSAGE QUEUEING ---
    const chatQueues = new Map();

    async function processMessage(msg) {
        try {
            if (msg.from === 'status@broadcast') return;
            const chat = await msg.getChat();
            const readingDelay = Math.floor(Math.random() * 1000) + 1000;
            await new Promise(resolve => setTimeout(resolve, readingDelay));
            await chat.sendStateTyping();

            if (msg.body === '!ping') {
                await msg.reply('pong');
                return;
            }

            if (msg.body === '!help') {
                await msg.reply(`*Bot Commands*\n\n!ping - Check bot\n!help - Show menu\n!sticker - Create sticker\n\n*Ask me anything about our business!*`);
                return;
            }

            if (msg.body === '!sticker') {
                if (msg.hasMedia) {
                    try {
                        const media = await msg.downloadMedia();
                        await client.sendMessage(msg.from, media, { sendMediaAsSticker: true });
                    } catch (err) {
                        await msg.reply('Error creating sticker.');
                    }
                } else {
                    await msg.reply('Please send an image or video with !sticker');
                }
                return;
            }

            const aiResponse = await getAIResponse(msg.body);
            const typingTime = Math.min(Math.max(aiResponse.length * 50, 2000), 7000);
            await new Promise(resolve => setTimeout(resolve, typingTime));
            await msg.reply(aiResponse);

        } catch (error) {
            console.error('Error handling message:', error);
        }
    }

    client.on('message', async msg => {
        const chatId = msg.from;
        const previousTask = chatQueues.get(chatId) || Promise.resolve();
        const currentTask = previousTask
            .then(() => processMessage(msg))
            .catch(err => console.error(`Queue error for ${chatId}:`, err))
            .finally(() => {
                if (chatQueues.get(chatId) === currentTask) {
                    chatQueues.delete(chatId);
                }
            });
        chatQueues.set(chatId, currentTask);
    });

    // Start the dashboard server (only once)
    const { setWhatsAppClient } = require('./server');
    setWhatsAppClient(client);

    if (!global.serverStarted) {
        startServer(client);
        global.serverStarted = true;
    }

    try {
        await client.initialize();
    } catch (err) {
        console.error('Failed to initialize client:', err);
    } finally {
        isInitializing = false;
    }
}

async function restartBot() {
    console.log('🔄 Restarting WhatsApp Bot...');
    if (client) {
        try {
            await client.destroy();
            console.log('Previous client destroyed.');
        } catch (err) {
            console.warn('Error destroying client:', err.message);
        }
    }
    client = null;
    await startBot();
}

startBot();

module.exports = {
    getClient: () => client,
    restartBot: restartBot
};

