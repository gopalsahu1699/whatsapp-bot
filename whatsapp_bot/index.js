require('dotenv').config();
const { Client, LocalAuth, RemoteAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { getAIResponse } = require('./ai');
const { SupabaseAuthStore } = require('./SupabaseAuthStore');
const { supabase } = require('./supabase');
const { startServer } = require('./server');
const fs = require('fs');
const path = require('path');

const { getAIEnabled, setAIEnabled } = require('./state');

let client;
let isInitializing = false;

// Initialize the client
function createClient(executablePath, authStrategy) {
    const isProd = process.env.RAILWAY_ENVIRONMENT || process.env.RENDER || process.env.NODE_ENV === 'production' || process.env.PORT;
    
    // On local Windows machines, avoid flags like '--single-process' and '--no-zygote' as they cause Chromium to hang/crash.
    const defaultArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu',
        '--no-default-browser-check',
        '--disable-extensions'
    ];

    if (isProd) {
        defaultArgs.push('--no-zygote', '--single-process', '--js-flags="--max-old-space-size=400"');
    }

    return new Client({
        authStrategy: authStrategy,
        authTimeoutMs: 60000,
        qrMaxRetries: 5,
        puppeteer: {
            executablePath: executablePath,
            args: defaultArgs,
            headless: true,
            userDataDir: process.env.USER_DATA_DIR
        }
    });
}

async function startBot() {
    // If a previous client instance is still alive, destroy it to avoid "browser already running" conflicts
    if (client) {
        try {
            await client.destroy();
            console.log('[Init] Destroyed previous client instance');
        } catch (e) {
            console.warn('[Init] Failed to destroy previous client:', e);
        }
        client = null;
    }
    if (isInitializing) return;
    isInitializing = true;

    console.log('Starting bot...');

    let authStrategy;
    if (process.env.SUPABASE_URL && (process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY)) {
        console.log('Connecting to Supabase for session storage...');
        try {
            const store = new SupabaseAuthStore(supabase);
            authStrategy = new RemoteAuth({
                clientId: 'whatsapp-bot',
                store: store,
                backupSyncIntervalMs: 300000
            });
            console.log('RemoteAuth strategy initialized with Supabase.');
        } catch (err) {
            console.error('Supabase session storage initialization failed, falling back to LocalAuth:', err);
            authStrategy = new LocalAuth();
        }
    } else {
        console.log('No Supabase credentials found, using LocalAuth.');
        authStrategy = new LocalAuth();
    }

    // Use a unique auth directory per start to avoid stale sessions
    const authDir = path.join(process.cwd(), `.wwebjs_auth_${Date.now()}`);
    fs.mkdirSync(authDir, { recursive: true });
    console.log(`[Init] Created ${authDir} directory for session storage`);
    // Apply USER_DATA_DIR only when using LocalAuth; RemoteAuth manages its own storage via Supabase.
    if (authStrategy && authStrategy.constructor && authStrategy.constructor.name === 'LocalAuth') {
        process.env.USER_DATA_DIR = authDir;
        console.log('[Init] USER_DATA_DIR set for LocalAuth');
        } else {
        console.log('[Init] RemoteAuth in use; skipping USER_DATA_DIR');
        // Ensure no leftover USER_DATA_DIR env var interferes with RemoteAuth
        delete process.env.USER_DATA_DIR;
    }
    let executablePath = process.env.CHROME_PATH || undefined;
    if (!executablePath && (process.env.RAILWAY_ENVIRONMENT || process.env.RENDER || process.env.NODE_ENV === 'production' || process.env.PORT)) {
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

    // Ensure we have a valid Chrome executable path on Windows when not in production
    if (!executablePath && process.platform === 'win32') {
        const possiblePaths = [
            'C:/Program Files/Google/Chrome/Application/chrome.exe',
            'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
        ];
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) { executablePath = p; break; }
        }
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

            console.log(`🟢 Received message from ${msg.from}: ${msg.body}`);
            const aiResponse = await getAIResponse(msg.body);
            // Log the AI response for debugging
            console.log('AI response:', aiResponse);
            // If the response is empty, send a default message
            const replyText = aiResponse && aiResponse.trim().length > 0 ? aiResponse : "I'm sorry, I couldn't generate a response at the moment. Please try again later.";
            const typingTime = Math.min(Math.max(replyText.length * 50, 2000), 7000);
            await new Promise(resolve => setTimeout(resolve, typingTime));
            await msg.reply(replyText);
            console.log('✅ Replied to user');

        } catch (error) {
            console.error('Error handling message:', error);
            // Inform user that something went wrong
            try {
                await msg.reply('Sorry, there was an internal error processing your message. Please try again later.');
            } catch (e) {
                console.error('Failed to send error reply:', e);
            }
        }
    }

    client.on('message', async msg => {
        if (!getAIEnabled()) {
            return;
        }
        // Ignore outgoing messages sent by the bot itself (prevents self-reply loops)
        if (msg.fromMe) {
            return;
        }
        // Fallback: also check WID match
        if (client.info && client.info.wid && msg.from === client.info.wid._serialized) {
            return;
        }
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

// New function to stop the bot without restarting
async function stopBot() {
    console.log('🛑 Stopping WhatsApp Bot...');
    if (client) {
        try {
            await client.destroy();
            console.log('Bot client destroyed.');
        } catch (err) {
            console.warn('Error destroying client during stop:', err.message);
        }
    }
    client = null;
}

startBot();

module.exports = {
    getClient: () => client,
    restartBot: restartBot,
    stopBot: stopBot,
    // Expose client control functions (AI flag handled via state module)
    // Note: getAIEnabled and setAIEnabled are provided by state.js
};

