const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
    name: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['text', 'poll'], default: 'text' },
    pollOptions: { type: [String], default: [] },
    imagePath: { type: String, default: null }, // This will now be the Cloudinary URL
    cloudinaryId: { type: String, default: null }, // To allow deleting images from Cloudinary
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const businessInfoSchema = new mongoose.Schema({
    aboutUs: { type: String, default: '' },
    products: { type: String, default: '' },
    faq: { type: String, default: '' },
    refundPolicy: { type: String, default: '' },
    contact: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now }
});

const campaignSchema = new mongoose.Schema({
    name: { type: String, required: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Template', required: true },
    sent: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const contactListSchema = new mongoose.Schema({
    name: { type: String, required: true },
    filename: { type: String },
    contactCount: { type: Number, default: 0 },
    lastUsedAt: { type: Date, default: null },
    usageCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const contactSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    listId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContactList', default: null },
    createdAt: { type: Date, default: Date.now }
});

const Template = mongoose.model('Template', templateSchema);
const BusinessInfo = mongoose.model('BusinessInfo', businessInfoSchema);
const Campaign = mongoose.model('Campaign', campaignSchema);
const ContactList = mongoose.model('ContactList', contactListSchema);
const Contact = mongoose.model('Contact', contactSchema);

module.exports = { Template, BusinessInfo, Campaign, ContactList, Contact };
