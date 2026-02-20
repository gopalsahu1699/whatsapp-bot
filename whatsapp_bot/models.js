const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
    name: { type: String, required: true },
    message: { type: String, required: true },
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

const Template = mongoose.model('Template', templateSchema);
const BusinessInfo = mongoose.model('BusinessInfo', businessInfoSchema);

module.exports = { Template, BusinessInfo };
