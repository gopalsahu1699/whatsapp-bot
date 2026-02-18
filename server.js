const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const QRCode = require('qrcode');
const csv = require('csv-parser');
const { createReadStream } = require('fs');
const { v4: uuidv4 } = require('uuid');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { Template, BusinessInfo } = require('./models');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Cloudinary Configuration
cloudinary.config({
    cloudinary_url: process.env.CLOUDINARY_URL
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'whatsapp-bot',
        allowed_formats: ['jpg', 'png', 'jpeg'],
        transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
    },
});

const upload = multer({ storage: storage });

const os = require('os');

// Separate storage for CSV files (Local storage, not Cloudinary)
const csvStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, os.tmpdir());
    },
    filename: function (req, file, cb) {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const csvUpload = multer({ storage: csvStorage });

// Required for secure cookies behind Render/Heroku proxy
app.set('trust proxy', 1);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Validate SESSION_SECRET in production
const SESSION_SECRET = process.env.SESSION_SECRET || 'fallback-secret-key';
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && (!SESSION_SECRET || SESSION_SECRET.length < 32 || SESSION_SECRET.includes('change-in-production') || SESSION_SECRET === 'fallback-secret-key')) {
    console.error('\n⚠️  SECURITY WARNING: Weak or default SESSION_SECRET detected in production!');
    console.error(`Debug Info: Secret Length: ${SESSION_SECRET ? SESSION_SECRET.length : 0}, Is Default: ${SESSION_SECRET === 'fallback-secret-key'}`);
    console.error('Generate a strong secret with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
    console.error('Add it to your .env file as SESSION_SECRET=<generated-secret>\n');
    process.exit(1);
}

// Session configuration
const sessionConfig = {
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: isProduction, // HTTPS only in production
        httpOnly: true, // Prevent XSS attacks
        sameSite: isProduction ? 'none' : 'lax', // Needed for cross-domain cookies in production
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
};

// Use MongoDB for session storage if available
if (process.env.MONGODB_URI) {
    const storeFactory = (typeof MongoStore.create === 'function') ? MongoStore : MongoStore.default;
    sessionConfig.store = storeFactory.create({
        mongoUrl: process.env.MONGODB_URI,
        ttl: 7 * 24 * 60 * 60 // 7 days
    });
}

app.use(session(sessionConfig));

// WhatsApp client (will be set from index.js)
let whatsappClient = null;
let qrCodeData = null;
let isClientReady = false;

// Set WhatsApp client from external module
function setWhatsAppClient(client) {
    whatsappClient = client;

    client.on('qr', async (qr) => {
        qrCodeData = await QRCode.toDataURL(qr);
        isClientReady = false;
        console.log('QR Code generated and ready for scan');
    });

    client.on('authenticated', () => {
        console.log('WhatsApp Authenticated');
        qrCodeData = null; // Clear QR as soon as authenticated
    });

    client.on('ready', () => {
        isClientReady = true;
        qrCodeData = null;
        console.log('WhatsApp Client is Ready');
    });

    client.on('auth_failure', (msg) => {
        console.error('WhatsApp Auth Failure:', msg);
        qrCodeData = null;
        isClientReady = false;
    });

    client.on('loading_screen', (percent, message) => {
        console.log(`WhatsApp Loading: ${percent}% - ${message}`);
    });

    client.on('disconnected', () => {
        isClientReady = false;
        qrCodeData = null;
        console.log('WhatsApp Client Disconnected');
    });

    // Check if it's already in a ready state
    if (client.info && client.info.wid) {
        console.log('WhatsApp detected as already ready on startup');
        isClientReady = true;
        qrCodeData = null;
    }
}

// Authentication middleware
function requireAuth(req, res, next) {
    if (req.session && req.session.authenticated) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
}

function replacePlaceholders(template, data) {
    let message = template;
    Object.keys(data).forEach(key => {
        const placeholder = `{{${key}}}`;
        message = message.replace(new RegExp(placeholder, 'g'), data[key]);
    });
    return message;
}

// ==================== AUTHENTICATION ROUTES ====================

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (username === process.env.DASHBOARD_USERNAME &&
        password === process.env.DASHBOARD_PASSWORD) {
        req.session.authenticated = true;
        req.session.username = username;
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/check-auth', (req, res) => {
    if (req.session && req.session.authenticated) {
        res.json({ authenticated: true, username: req.session.username });
    } else {
        res.json({ authenticated: false });
    }
});

// ==================== WHATSAPP ROUTES ====================

app.get('/api/whatsapp/status', requireAuth, (req, res) => {
    // Proactive check: If the flag is false but client info exists, we are connected
    if (!isClientReady && whatsappClient && whatsappClient.info && whatsappClient.info.wid) {
        isClientReady = true;
        qrCodeData = null;
    }

    res.json({
        connected: isClientReady,
        hasQR: qrCodeData !== null
    });
});

app.get('/api/whatsapp/qr', requireAuth, (req, res) => {
    if (qrCodeData) {
        res.json({ qr: qrCodeData });
    } else {
        res.json({ qr: null });
    }
});

app.post('/api/whatsapp/disconnect', requireAuth, async (req, res) => {
    try {
        if (whatsappClient) {
            await whatsappClient.destroy();
            isClientReady = false;
            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'Client not initialized' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== TEMPLATE ROUTES ====================

app.get('/api/templates', requireAuth, async (req, res) => {
    try {
        const templates = await Template.find().sort({ createdAt: -1 });
        res.json(templates);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/templates', requireAuth, upload.single('image'), async (req, res) => {
    try {
        const { name, message } = req.body;

        const newTemplate = new Template({
            name,
            message,
            imagePath: req.file ? req.file.path : null, // Cloudinary URL
            cloudinaryId: req.file ? req.file.filename : null // Cloudinary public ID
        });

        await newTemplate.save();
        res.json(newTemplate);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/templates/:id', requireAuth, upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, message, removeImage } = req.body;

        const template = await Template.findById(id);
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        template.name = name;
        template.message = message;

        if (req.file) {
            // Delete old image from Cloudinary if exists
            if (template.cloudinaryId) {
                try { await cloudinary.uploader.destroy(template.cloudinaryId); } catch (err) { }
            }
            template.imagePath = req.file.path;
            template.cloudinaryId = req.file.filename;
        } else if (removeImage === 'true') {
            if (template.cloudinaryId) {
                try { await cloudinary.uploader.destroy(template.cloudinaryId); } catch (err) { }
            }
            template.imagePath = null;
            template.cloudinaryId = null;
        }

        template.updatedAt = Date.now();
        await template.save();
        res.json(template);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/templates/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const template = await Template.findById(id);

        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        // Delete associated image from Cloudinary
        if (template.cloudinaryId) {
            try { await cloudinary.uploader.destroy(template.cloudinaryId); } catch (err) { }
        }

        await Template.findByIdAndDelete(id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== BULK MESSAGING ROUTES ====================

app.post('/api/bulk/upload-csv', requireAuth, csvUpload.single('csv'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const contacts = [];
        const filePath = req.file.path;

        // Parse CSV
        await new Promise((resolve, reject) => {
            createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => {
                    contacts.push(row);
                })
                .on('end', resolve)
                .on('error', reject);
        });

        res.json({
            success: true,
            count: contacts.length,
            contacts: contacts,
            filePath: `/uploads/csv/${req.file.filename}`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/bulk/send', requireAuth, async (req, res) => {
    try {
        const { contacts, templateId } = req.body;

        if (!whatsappClient || !isClientReady) {
            return res.status(400).json({ error: 'WhatsApp not connected' });
        }

        const template = await Template.findById(templateId);

        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        // Set headers for Server-Sent Events
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        let sent = 0;
        let failed = 0;

        // Pre-load media if template has an image to avoid redundant loads in the loop
        let cachedMedia = null;
        if (template.imagePath) {
            try {
                const { MessageMedia } = require('whatsapp-web.js');
                cachedMedia = await MessageMedia.fromUrl(template.imagePath);
                console.log('Template media cached for bulk sending');
            } catch (err) {
                console.error('Failed to pre-load template media:', err.message);
            }
        }

        for (let i = 0; i < contacts.length; i++) {
            const contact = contacts[i];

            try {
                // Replace placeholders in message
                const message = replacePlaceholders(template.message, contact);

                // Format phone number
                let phoneNumber = contact.phone || contact.number;
                if (!phoneNumber) {
                    throw new Error('No phone/number field found in CSV');
                }

                let phone = phoneNumber.toString().replace(/\D/g, '');
                if (!phone.startsWith('91') && phone.length === 10) {
                    phone = '91' + phone;
                }
                const chatId = phone + '@c.us';

                // Human-like behavior: Simulate typing for 5 seconds
                try {
                    const chat = await whatsappClient.getChatById(chatId);
                    await chat.sendStateTyping();
                    await new Promise(resolve => setTimeout(resolve, 5000));
                } catch (typingErr) {
                    console.warn(`Could not simulate typing for ${phone}:`, typingErr.message);
                }

                // Optimized path: If image exists, send it. If not, just send text.
                // We send image first often or as separate message.

                if (cachedMedia) {
                    await whatsappClient.sendMessage(chatId, cachedMedia, { caption: message });
                } else {
                    await whatsappClient.sendMessage(chatId, message);
                }

                sent++;

                // Send progress update
                res.write(`data: ${JSON.stringify({
                    sent,
                    failed,
                    total: contacts.length,
                    current: contact.name || phoneNumber,
                    percentage: Math.round(((sent + failed) / contacts.length) * 100)
                })}\n\n`);

                // Reduced Anti-Ban Delay: (4-8 seconds is generally safe for 50 messages)
                const delay = Math.floor(Math.random() * 4000) + 4000;
                await new Promise(resolve => setTimeout(resolve, delay));

            } catch (error) {
                failed++;
                const phoneNumber = contact.phone || contact.number || 'unknown';
                console.error(`Failed to send to ${phoneNumber}:`, error.message);

                res.write(`data: ${JSON.stringify({
                    sent,
                    failed,
                    total: contacts.length,
                    error: `Failed: ${contact.name || phoneNumber}`,
                    percentage: Math.round(((sent + failed) / contacts.length) * 100)
                })}\n\n`);
            }
        }

        // Send completion
        res.write(`data: ${JSON.stringify({
            sent,
            failed,
            total: contacts.length,
            complete: true,
            percentage: 100
        })}\n\n`);

        res.end();

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== AI TRAINING ROUTES ====================

app.get('/api/training/data', requireAuth, async (req, res) => {
    try {
        let trainingData = await BusinessInfo.findOne();
        if (!trainingData) {
            // Return empty structure if none exists
            trainingData = {
                aboutUs: '',
                products: '',
                faq: '',
                refundPolicy: '',
                contact: ''
            };
        }
        res.json(trainingData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/training/data', requireAuth, async (req, res) => {
    try {
        const data = req.body;
        let trainingData = await BusinessInfo.findOne();

        if (trainingData) {
            Object.assign(trainingData, data);
            trainingData.updatedAt = Date.now();
            await trainingData.save();
        } else {
            trainingData = new BusinessInfo(data);
            await trainingData.save();
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== START SERVER ====================

function startServer(client) {
    setWhatsAppClient(client);

    app.listen(PORT, () => {
        console.log(`\n🚀 Dashboard server running at http://localhost:${PORT}\n`);

        // Start Keep-Alive to prevent Render from sleeping
        const APP_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
        if (APP_URL.includes('onrender.com')) {
            console.log(`📡 Keep-Alive initialized for: ${APP_URL}`);
            // Ping every 5 minutes
            setInterval(async () => {
                try {
                    const fetch = (await import('node-fetch')).default;
                    await fetch(APP_URL);
                    console.log(`🌱 Keep-Alive: Pinged ${APP_URL} at ${new Date().toISOString()}`);
                } catch (err) {
                    console.error('❌ Keep-Alive Ping failed:', err.message);
                }
            }, 5 * 60 * 1000); // 5 minutes
        }
    });
}

module.exports = { startServer, setWhatsAppClient };
