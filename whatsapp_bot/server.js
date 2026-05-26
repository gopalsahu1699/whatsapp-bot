const express = require('express');
const session = require('express-session');
const app = express();
const PORT = process.env.PORT || 3000; // Port configuration

const { supabase } = require('./supabase');
const {
  getAllTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getBusinessInfo,
  upsertBusinessInfo,
  insertCampaign,
  getAllCampaigns,
  createContactList,
  getAllContactLists,
  getContactListById,
  deleteContactList,
  insertContacts,
  getContactsByListId,
  updateContactListUsage
} = require('./supabaseModels');

const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const QRCode = require('qrcode');
const csv = require('csv-parser');
const { createReadStream } = require('fs');
const { v4: uuidv4 } = require('uuid');
// Supabase bucket for template images (fallback to 'templates')
const templateBucket = process.env.SUPABASE_BUCKET || 'templates';
// Verify bucket exists at startup
(async () => {
  const { data: bucketInfo, error: bucketErr } = await supabase.storage.getBucket(templateBucket);
  if (bucketErr) {
    console.error(`❌ Supabase bucket "${templateBucket}" not found. Create it in the dashboard or update SUPABASE_BUCKET in .env.`);
    process.exit(1);
  }
})();
// Use disk storage for temporary file handling before uploading to Supabase
const templateStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, os.tmpdir());
    },
    filename: function (req, file, cb) {
        const uniqueName = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});
// Multer instance for handling template image uploads
const upload = multer({ storage: templateStorage });

const os = require('os');

// Cloudinary integration removed; using Supabase storage for template images

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

let sessionMiddleware = session(sessionConfig);

app.use((req, res, next) => {
  sessionMiddleware(req, res, next);
});

// WhatsApp client (will be set from index.js)
let whatsappClient = null;
let qrCodeData = null;
let isClientReady = false;

// Set WhatsApp client from external module
function setWhatsAppClient(client) {
    whatsappClient = client;

    // Reset state for the new client
    qrCodeData = null;
    isClientReady = false;

    client.on('qr', async (qr) => {
        qrCodeData = await QRCode.toDataURL(qr);
        isClientReady = false;
        console.log('[Dashboard] QR Code generated and ready for scan');
    });

    client.on('authenticated', () => {
        console.log('[Dashboard] WhatsApp Authenticated - clearing QR');
        qrCodeData = null; // Clear QR as soon as authenticated
    });

    client.on('ready', () => {
        isClientReady = true;
        qrCodeData = null;
        console.log('[Dashboard] WhatsApp Client is Ready and Connected');
    });

    client.on('auth_failure', (msg) => {
        console.error('[Dashboard] WhatsApp Auth Failure:', msg);
        qrCodeData = null;
        isClientReady = false;
    });

    client.on('loading_screen', (percent, message) => {
        console.log(`[Dashboard] WhatsApp Loading: ${percent}% - ${message}`);
    });

    client.on('disconnected', (reason) => {
        isClientReady = false;
        qrCodeData = null;
        console.log('[Dashboard] WhatsApp Client Disconnected:', reason);
    });
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

// Health check / Splash endpoint
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'splash.html'));
});

// ==================== WHATSAPP ROUTES ====================

app.get('/api/whatsapp/status', requireAuth, async (req, res) => {
    try {
        // Live state check: use getState() for the most accurate result
        if (whatsappClient) {
            try {
                const state = await whatsappClient.getState();
                if (state === 'CONNECTED') {
                    isClientReady = true;
                    qrCodeData = null;
                }
            } catch (stateErr) {
                // getState() can fail if browser is not ready yet - fallback to info check
                if (whatsappClient.info && whatsappClient.info.wid) {
                    isClientReady = true;
                    qrCodeData = null;
                }
            }
        }

        res.json({
            connected: isClientReady,
            hasQR: qrCodeData !== null
        });
    } catch (error) {
        res.json({
            connected: false,
            hasQR: qrCodeData !== null
        });
    }
});

app.get('/api/whatsapp/qr', requireAuth, (req, res) => {
    if (qrCodeData) {
        res.json({ qr: qrCodeData });
    } else {
        res.json({ qr: null });
    }
});

app.post('/api/whatsapp/restart', requireAuth, async (req, res) => {
    try {
        const { restartBot } = require('./index');
        // Don't await because it might take a while, just trigger it
        restartBot();
        isClientReady = false;
        qrCodeData = null;
        res.json({ success: true, message: 'Restarting WhatsApp client...' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== TEMPLATE ROUTES ====================

app.get('/api/templates', requireAuth, async (req, res) => {
    try {
        const templates = await getAllTemplates();
        // Ensure each template has a valid public URL for the image
        const enrichedTemplates = await Promise.all(templates.map(async (t) => {
          if (t.cloudinary_id) {
            const { data: { publicUrl } } = supabase.storage.from(templateBucket).getPublicUrl(t.cloudinary_id);
            t.image_path = publicUrl;
          }
          return t;
        }));
        res.json(enrichedTemplates);
    } catch (error) {
        console.warn('[Templates] MongoDB find failed, falling back to templates.json:', error.message);
        try {
            const data = await fs.readFile(path.join(__dirname, 'templates.json'), 'utf8');
            const localTemplates = JSON.parse(data);
            res.json(localTemplates);
        } catch (fileErr) {
            res.status(500).json({ error: `Database error and templates.json fallback failed: ${error.message}` });
        }
    }
});

app.get('/api/templates/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        let template;
        try {
            template = await getTemplateById(id);
        } catch (dbErr) {
            if (dbErr.code === 'PGRST116') {
                // Not found in Supabase database, let's check templates.json fallback
                try {
                    const data = await fs.readFile(path.join(__dirname, 'templates.json'), 'utf8');
                    const localTemplates = JSON.parse(data);
                    template = localTemplates.find(t => (t.id == id || t._id == id));
                } catch (fileErr) {
                    // Fallback file doesn't exist or read error, but we know it's a 404 from DB
                }
            } else {
                // Real database error, throw to outer catch
                throw dbErr;
            }
        }

        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        if (template.cloudinary_id) {
            const { data: { publicUrl } } = supabase.storage.from(templateBucket).getPublicUrl(template.cloudinary_id);
            template.image_path = publicUrl;
        }
        res.json(template);
    } catch (error) {
        console.error(`[Templates] GET single template error:`, error);
        res.status(500).json({ error: error.message || 'Failed to retrieve template' });
    }
});

app.post('/api/templates', requireAuth, upload.single('image'), async (req, res) => {
    const { name, message, type, pollOptions } = req.body;
    try {
        let image_path = null;
        let storage_path = null;
        if (req.file) {
            const fs = require('fs').promises;
            const fileBuffer = await fs.readFile(req.file.path);
            const fileName = `${Date.now()}-${req.file.originalname}`;
            const { data: uploadData, error: uploadError } = await supabase.storage.from(templateBucket).upload(fileName, fileBuffer, {
                upsert: false,
                contentType: req.file.mimetype,
            });
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage.from(templateBucket).getPublicUrl(fileName);
            image_path = publicUrl;
            storage_path = fileName;
        }

        const templateData = {
            name,
            message,
            type: type || 'text',
            poll_options: pollOptions ? JSON.parse(pollOptions) : [],
            image_path: image_path,
            cloudinary_id: storage_path
        };
        const createdTemplate = await createTemplate(templateData);
        res.json(createdTemplate);
    } catch (error) {
        console.warn('[Templates] MongoDB save failed, saving to templates.json fallback:', error.message);
        try {
            let localTemplates = [];
            try {
                const data = await fs.readFile(path.join(__dirname, 'templates.json'), 'utf8');
                localTemplates = JSON.parse(data);
            } catch (readErr) {
                // Ignore read error if file doesn't exist
            }
            
            const newLocalTemplate = {
                id: Date.now(),
                name,
                message,
                type: type || 'text',
                pollOptions: pollOptions ? JSON.parse(pollOptions) : [],
                imagePath: req.file ? req.file.path : null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            localTemplates.push(newLocalTemplate);
            await fs.writeFile(path.join(__dirname, 'templates.json'), JSON.stringify(localTemplates, null, 2), 'utf8');
            res.json(newLocalTemplate);
        } catch (fileErr) {
            res.status(500).json({ error: `Database error and templates.json fallback failed: ${error.message}` });
        }
    }
});

app.put('/api/templates/:id', requireAuth, upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, message, removeImage, type, pollOptions } = req.body;

        const template = await getTemplateById(id);
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        const updates = {
            name,
            message,
            type: type || 'text',
            poll_options: pollOptions ? JSON.parse(pollOptions) : []
        };

        if (req.file) {
            // Delete existing image from Supabase storage first if it exists
            if (template.cloudinary_id) {
                try {
                    await supabase.storage.from(templateBucket).remove([template.cloudinary_id]);
                } catch (e) {
                    console.warn('Failed to delete old image from storage:', e.message);
                }
            }
            // Upload new image to Supabase
            const fs = require('fs').promises;
            const fileBuffer = await fs.readFile(req.file.path);
            const fileName = `${Date.now()}-${req.file.originalname}`;
            const { data: uploadData, error: uploadError } = await supabase.storage.from(templateBucket).upload(fileName, fileBuffer, {
                upsert: false,
                contentType: req.file.mimetype,
            });
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage.from(templateBucket).getPublicUrl(fileName);
            updates.image_path = publicUrl;
            updates.cloudinary_id = fileName;
        } else if (removeImage === 'true') {
            // Delete existing image from storage if user explicitly requested removal
            if (template.cloudinary_id) {
                try {
                    await supabase.storage.from(templateBucket).remove([template.cloudinary_id]);
                } catch (e) {
                    console.warn('Failed to delete image from storage:', e.message);
                }
            }
            updates.image_path = null;
            updates.cloudinary_id = null;
        }

        const updatedTemplate = await updateTemplate(id, updates);
        res.json(updatedTemplate);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/templates/:id', requireAuth, async (req, res) => {
    try {
        const id = req.params.id;
        if (!id) {
            return res.status(400).json({ error: 'Template ID is required' });
        }
        const template = await getTemplateById(id);
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }
        // Delete associated image from Supabase
        if (template.cloudinary_id) {
            try {
                await supabase.storage.from(templateBucket).remove([template.cloudinary_id]);
            } catch (err) {
                console.warn('Failed to delete image from storage:', err.message);
            }
        }
        // Delete the template record
        await deleteTemplate(id);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete template error:', error);
        res.status(500).json({ error: error.message || 'Failed to delete template' });
    }
});

// ==================== BULK MESSAGING ROUTES ====================

app.post('/api/bulk/upload-csv', requireAuth, csvUpload.single('csv'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Parse CSV and save to database
        const contactsToSave = [];
        const filePath = req.file.path;
        await new Promise((resolve, reject) => {
            createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => {
                    // Try to find phone and name with basic field name detection
                    const phoneField = Object.keys(row).find(k => k.toLowerCase().includes('phone') || k.toLowerCase().includes('number') || k.toLowerCase().includes('mobile'));
                    const nameField = Object.keys(row).find(k => k.toLowerCase().includes('name'));

                    let name = nameField ? row[nameField]?.trim() : 'Unknown';
                    let rawPhone = phoneField ? row[phoneField]?.trim() : null;

                    if (rawPhone) {
                        // Clean phone number format
                        let phone = rawPhone.toString().replace(/\D/g, '');
                        if (!phone.startsWith('91') && phone.length === 10) {
                            phone = '91' + phone;
                        }
                        contactsToSave.push({ name, phone });
                    }
                })
                .on('end', resolve)
                .on('error', reject);
        });

        if (contactsToSave.length === 0) {
            return res.status(400).json({ error: 'No valid contacts found in CSV' });
        }

        // Create the Contact List entry
        const listData = {
            name: req.body.listName || req.file.originalname.replace('.csv', ''),
            filename: req.file.originalname,
            contact_count: contactsToSave.length
        };
        const newList = await createContactList(listData);

        // Attach listId to all contacts and save them
        const finalContacts = contactsToSave.map(c => ({
            ...c,
            list_id: newList.id
        }));
        await insertContacts(finalContacts);

        res.json({
            success: true,
            count: finalContacts.length,
            listId: newList.id,
            listName: newList.name,
            contacts: finalContacts
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/bulk/send', requireAuth, async (req, res) => {
    try {
        const { contacts, templateId, delay, listId } = req.body;

        // If a listId is provided, update usage stats
        if (listId) {
            try {
                await updateContactListUsage(listId);
            } catch (err) {
                console.error('Failed to update list usage stats:', err);
            }
        }

        if (!whatsappClient || !isClientReady) {
            return res.status(400).json({ error: 'WhatsApp not connected' });
        }

        const template = await getTemplateById(templateId);

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
        if (template.image_path) {
            try {
                const { MessageMedia } = require('whatsapp-web.js');
                cachedMedia = await MessageMedia.fromUrl(template.image_path);
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

                if (template.type === 'poll') {
                    const { Poll } = require('whatsapp-web.js');
                    const poll = new Poll(message, template.poll_options);
                    await whatsappClient.sendMessage(chatId, poll);
                } else if (cachedMedia) {
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

                // Calculate wait time
                let sleepTime = 20000; // default 20 seconds
                if (delay === '4-8') {
                    sleepTime = Math.floor(Math.random() * 4000) + 4000;
                } else if (delay) {
                    sleepTime = parseInt(delay, 10) * 1000;
                }

                // Anti-Ban Delay
                await new Promise(resolve => setTimeout(resolve, sleepTime));

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

        // Save Campaign Analytics (both Mongo and local JSON fallback)
        const campaignPayload = {
            id: Date.now().toString(),
            name: `Campaign - ${template.name} - ${new Date().toLocaleDateString()}`,
            template_id: template.id || 'local',
            template_name: template.name,
            template_type: template.type || 'text',
            sent: sent,
            failed: failed,
            total: contacts.length,
            created_at: new Date().toISOString()
        };

        try {
            await insertCampaign(campaignPayload);
            console.log(`[Analytics] Campaign saved to Supabase`);
        } catch (analyticsErr) {
            console.warn('[Analytics] Failed to save campaign to Supabase, using local copy:', analyticsErr.message);
        }

        // Always save to campaigns.json backup
        try {
            let localCampaigns = [];
            try {
                const data = await fs.readFile(path.join(__dirname, 'campaigns.json'), 'utf8');
                localCampaigns = JSON.parse(data);
            } catch (readErr) {
                // Ignore file doesn't exist
            }
            localCampaigns.push(campaignPayload);
            await fs.writeFile(path.join(__dirname, 'campaigns.json'), JSON.stringify(localCampaigns, null, 2), 'utf8');
            console.log('[Analytics] Campaign saved to local campaigns.json backup.');
        } catch (fileErr) {
            console.error('[Analytics] Failed to save campaign backup locally:', fileErr.message);
        }

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== ANALYTICS ROUTES ====================

app.get('/api/analytics', requireAuth, async (req, res) => {
    try {
        const campaigns = await getAllCampaigns();
        res.json(campaigns);
    } catch (error) {
        console.warn('[Analytics] Supabase find failed, falling back to campaigns.json:', error.message);
        try {
            let campaignsData = '[]';
            try {
                campaignsData = await fs.readFile(path.join(__dirname, 'campaigns.json'), 'utf8');
            } catch (readErr) {
                // Ignore read error if file doesn't exist yet, we'll write an empty array
                await fs.writeFile(path.join(__dirname, 'campaigns.json'), '[]', 'utf8');
            }
            const localCampaigns = JSON.parse(campaignsData);
            res.json(localCampaigns);
        } catch (fileErr) {
            res.status(500).json({ error: `Database error and campaigns.json fallback failed: ${error.message}` });
        }
    }
});

app.get('/api/analytics/advice', requireAuth, async (req, res) => {
    try {
        const { getCampaignAdvice } = require('./ai');

        let campaigns = await getAllCampaigns();
        campaigns = campaigns.slice(0, 10); 
        if (campaigns.length === 0) {
            return res.json({ advice: "You haven't run any campaigns yet! Start by sending your first bulk message to get personalized growth advice." });
        }

        let totalSent = 0;
        let totalFailed = 0;
        let totalContacts = 0;

        const campaignSummaries = campaigns.map(c => {
            totalSent += c.sent;
            totalFailed += c.failed;
            totalContacts += c.total;
            return {
                name: c.name,
                date: c.createdAt,
                successRate: c.total > 0 ? ((c.sent / c.total) * 100).toFixed(1) + '%' : '0%',
                sent: c.sent,
                failed: c.failed
            };
        });

        const overallStats = {
            totalCampaignsAnalyzed: campaigns.length,
            overallSent: totalSent,
            overallFailed: totalFailed,
            overallSuccessRate: totalContacts > 0 ? ((totalSent / totalContacts) * 100).toFixed(1) + '%' : '0%',
            recentCampaigns: campaignSummaries
        };

        const advice = await getCampaignAdvice(overallStats);
        res.json({ advice });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== AI TRAINING ROUTES ====================

app.get('/api/training/data', requireAuth, async (req, res) => {
    try {
        let trainingData = await getBusinessInfo();
        if (!trainingData) {
            trainingData = {
                about_us: '',
                products: '',
                faq: '',
                refund_policy: '',
                contact: ''
            };
        }
        res.json(trainingData);
    } catch (error) {
        console.warn('[Training] MongoDB find failed, falling back to business_info.json:', error.message);
        try {
            const data = await fs.readFile(path.join(__dirname, 'business_info.json'), 'utf8');
            const localData = JSON.parse(data);
            res.json(localData);
        } catch (fileErr) {
            res.status(500).json({ error: `Database error and business_info.json fallback failed: ${error.message}` });
        }
    }
});

app.post('/api/training/data', requireAuth, async (req, res) => {
    const data = req.body;
    try {
        await upsertBusinessInfo(data);

        // Also save/backup to local file
        try {
            await fs.writeFile(path.join(__dirname, 'business_info.json'), JSON.stringify(data, null, 4), 'utf8');
        } catch (err) {
            console.error('Failed to write business_info.json backup:', err.message);
        }

        res.json({ success: true });
    } catch (error) {
        console.warn('[Training] MongoDB save failed, falling back to saving business_info.json directly:', error.message);
        try {
            await fs.writeFile(path.join(__dirname, 'business_info.json'), JSON.stringify(data, null, 4), 'utf8');
            res.json({ success: true, localOnly: true });
        } catch (fileErr) {
            res.status(500).json({ error: `Database save failed and local file fallback failed: ${error.message}` });
        }
    }
});

// ==================== CONTACT ROUTES ====================

app.get('/api/contact-lists', requireAuth, async (req, res) => {
    try {
        const lists = await getAllContactLists();
        res.json(lists);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/contact-lists/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const list = await getContactListById(id);
        if (!list) return res.status(404).json({ error: 'List not found' });
        const contacts = await getContactsByListId(id);
        res.json({ list, contacts });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/contact-lists/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        // Delete the list metadata
        const deleted = await deleteContactList(id);
        if (!deleted) return res.status(404).json({ error: 'List not found' });
        // Note: contacts are cascade deleted via DB triggers or handled separately.
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all contacts (Supabase)
app.get('/api/contacts', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('contacts').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new contact (Supabase)
app.post('/api/contacts', requireAuth, async (req, res) => {
  try {
    let { name, phone } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }
    // Clean phone number
    phone = phone.toString().replace(/\D/g, '');
    if (!phone.startsWith('91') && phone.length === 10) {
      phone = '91' + phone;
    }
    const { data, error } = await supabase.from('contacts').insert([{ name, phone }]).single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a contact (Supabase)
app.put('/api/contacts/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    let { name, phone } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }
    // Clean phone number
    phone = phone.toString().replace(/\D/g, '');
    if (!phone.startsWith('91') && phone.length === 10) {
      phone = '91' + phone;
    }
    const { data, error } = await supabase
      .from('contacts')
      .update({ name, phone })
      .eq('id', id)
      .single();
    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/contacts/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from('contacts').delete().eq('id', id).single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Contact not found' });
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
