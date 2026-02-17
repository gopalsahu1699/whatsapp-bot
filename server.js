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
require('dotenv').config();

const app = express();
const PORT = 3000;

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
    // connect-mongo v4+ uses .create, but let's be super safe with the import
    const storeFactory = (typeof MongoStore.create === 'function') ? MongoStore : MongoStore.default;
    sessionConfig.store = storeFactory.create({
        mongoUrl: process.env.MONGODB_URI,
        ttl: 7 * 24 * 60 * 60 // 7 days
    });
}

app.use(session(sessionConfig));

// File upload configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = file.fieldname === 'image'
            ? 'public/uploads/images'
            : 'public/uploads/csv';
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'image') {
            if (file.mimetype.startsWith('image/')) {
                cb(null, true);
            } else {
                cb(new Error('Only image files are allowed'));
            }
        } else if (file.fieldname === 'csv') {
            if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
                cb(null, true);
            } else {
                cb(new Error('Only CSV files are allowed'));
            }
        } else {
            cb(null, true);
        }
    }
});

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

    client.on('disconnected', () => {
        isClientReady = false;
        qrCodeData = null;
        console.log('WhatsApp Client Disconnected');
    });

    // Check if it's already in a ready state (though unlikely with current order)
    if (client.info && client.info.wid) {
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

// Helper functions
async function readTemplates() {
    try {
        const data = await fs.readFile('templates.json', 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

async function writeTemplates(templates) {
    await fs.writeFile('templates.json', JSON.stringify(templates, null, 2));
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
        const templates = await readTemplates();
        res.json(templates);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/templates', requireAuth, upload.single('image'), async (req, res) => {
    try {
        const { name, message } = req.body;
        const templates = await readTemplates();

        const newTemplate = {
            id: uuidv4(),
            name,
            message,
            imagePath: req.file ? `/uploads/images/${req.file.filename}` : null,
            createdAt: new Date().toISOString()
        };

        templates.push(newTemplate);
        await writeTemplates(templates);

        res.json(newTemplate);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/templates/:id', requireAuth, upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, message, removeImage } = req.body;
        const templates = await readTemplates();

        const index = templates.findIndex(t => t.id == id);
        if (index === -1) {
            return res.status(404).json({ error: 'Template not found' });
        }

        // Handle image update
        let imagePath = templates[index].imagePath;
        if (req.file) {
            // Delete old image if exists
            if (imagePath) {
                try {
                    await fs.unlink(path.join('public', imagePath));
                } catch (err) { }
            }
            imagePath = `/uploads/images/${req.file.filename}`;
        } else if (removeImage === 'true') {
            // Delete old image
            if (imagePath) {
                try {
                    await fs.unlink(path.join('public', imagePath));
                } catch (err) { }
            }
            imagePath = null;
        }

        templates[index] = {
            ...templates[index],
            name,
            message,
            imagePath,
            updatedAt: new Date().toISOString()
        };

        await writeTemplates(templates);
        res.json(templates[index]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/templates/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const templates = await readTemplates();

        const index = templates.findIndex(t => t.id == id);
        if (index === -1) {
            return res.status(404).json({ error: 'Template not found' });
        }

        // Delete associated image
        if (templates[index].imagePath) {
            try {
                await fs.unlink(path.join('public', templates[index].imagePath));
            } catch (err) { }
        }

        templates.splice(index, 1);
        await writeTemplates(templates);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== BULK MESSAGING ROUTES ====================

app.post('/api/bulk/upload-csv', requireAuth, upload.single('csv'), async (req, res) => {
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

        const templates = await readTemplates();
        const template = templates.find(t => t.id === templateId);

        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        // Set headers for Server-Sent Events
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        let sent = 0;
        let failed = 0;

        for (let i = 0; i < contacts.length; i++) {
            const contact = contacts[i];

            try {
                // Replace placeholders in message
                const message = replacePlaceholders(template.message, contact);

                // Format phone number (support both 'phone' and 'number' column names)
                let phoneNumber = contact.phone || contact.number;
                if (!phoneNumber) {
                    throw new Error('No phone/number field found in CSV');
                }

                let phone = phoneNumber.toString().replace(/\D/g, '');
                if (!phone.startsWith('91') && phone.length === 10) {
                    phone = '91' + phone;
                }
                const chatId = phone + '@c.us';

                // Send message
                await whatsappClient.sendMessage(chatId, message);

                // Send image if template has one
                if (template.imagePath) {
                    const { MessageMedia } = require('whatsapp-web.js');
                    const media = MessageMedia.fromFilePath(path.join('public', template.imagePath));
                    await whatsappClient.sendMessage(chatId, media);
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

                // Delay to avoid spam detection (2-5 seconds)
                const delay = Math.floor(Math.random() * 3000) + 2000;
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
        const filePath = path.join(__dirname, 'business_info.json');
        const fileContent = await fs.readFile(filePath, 'utf8');
        res.json(JSON.parse(fileContent));
    } catch (error) {
        // If file doesn't exist, return empty structure
        res.json({
            aboutUs: '',
            products: '',
            faq: '',
            refundPolicy: '',
            contact: ''
        });
    }
});

app.post('/api/training/data', requireAuth, async (req, res) => {
    try {
        const trainingData = req.body;
        if (!trainingData || typeof trainingData !== 'object') {
            return res.status(400).json({ error: 'Invalid data format' });
        }

        const filePath = path.join(__dirname, 'business_info.json');
        await fs.writeFile(filePath, JSON.stringify(trainingData, null, 2), 'utf8');
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
    });
}

module.exports = { startServer, setWhatsAppClient };
