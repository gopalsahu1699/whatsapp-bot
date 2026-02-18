const mongoose = require('mongoose');
const { BusinessInfo } = require('./models');
require('dotenv').config();

const data = {
    aboutUs: `Autommensor is an Indian smart home automation company focused on wireless smart home solutions that enhance comfort, safety, convenience, and energy efficiency for modern residential spaces. Based in Bilaspur, Chhattisgarh, India (registered office in Seepat). Offers smart home products and services with 24/7 support, 10-year warranty, and a claim of 200+ happy customers. Provides mobile app integration and cloud control for managed automation and device control.`,

    products: `Voice-Enabled Smart Home Control – Compatible with Amazon Alexa and Google Assistant for voice commands.
Smart Lighting & Control Panels – Touch panels and smart switches to control lights and appliances.
Intelligent Sensors – For automation based on motion, environment, or predefined triggers.
Digital Door Locks & Security Automation – Advanced keyless entry with smart monitoring.
Video Door Phones – Real-time monitoring and communication with visitors via smartphone.
Smart Curtain Automation – Scheduled or remote curtain control for comfort and privacy.
Scene Creation & Group Control – Multiple devices can be controlled together under a single “scene” (e.g., Movie Night, Good Morning).`,

    faq: `1. What is Autommensor?
Autommensor is a smart home automation company offering wireless smart solutions for lighting, security, and appliance control, compatible with mobile apps and voice assistants.

2. How can I control my smart home devices?
You can control devices using the Autommensor mobile app from anywhere, or with voice assistants like Amazon Alexa and Google Assistant.

3. What products do you offer?
Smart switches and panels, Digital door locks, Motion and environment sensors, Video door phones, Smart curtain automation, Scene creation for multiple devices.

4. Can I automate multiple devices together?
Yes, you can create scenes that control multiple devices at once, e.g., Movie Night or Good Morning modes.

5. Do you provide installation services?
Yes, Autommensor provides installation support and device configuration to ensure smooth setup.

6. Is there a warranty for products?
Yes, Autommensor products come with a 10-year warranty and lifetime support.

7. Can I control devices remotely?
Absolutely. Devices are cloud-connected and can be controlled remotely via the mobile app.

8. Are your products safe and secure?
Yes, all devices are designed with advanced security features like encrypted communication and keyless door locks.

9. How can I get support if something goes wrong?
You can reach support via: Phone: +91-8718847083 / +91-8085782471, Email: autommensor@gmail.com, WhatsApp support is also available.

10. Are Autommensor devices compatible with other smart home systems?
Most products are compatible with popular voice assistants and can integrate with other IoT ecosystems.`,

    refundPolicy: `All Sales Are Final: All purchases of Autommensor products and services are final. Once an order is confirmed and payment is received, it cannot be canceled or refunded.

Defective or Damaged Products: If a product arrives defective or damaged, please contact us within 7 days of delivery. We will replace or repair the item at no extra cost. Refunds will not be issued.

Installation Services: Payments for installation services are non-refundable once the service is scheduled or completed.

Digital Products or Software: Purchases of mobile apps, software, or cloud services are non-refundable, as they are immediately accessible upon purchase.

Warranty Coverage: All products come with a 10-year warranty, covering hardware defects and malfunctions under normal usage. Warranty replacements are handled separately and do not constitute a refund.

Customer Responsibility: Customers are responsible for verifying the product model, compatibility, and specifications before purchase. Refunds will not be provided for change of mind or incorrect selection.`,

    contact: `Phone: +91-8718847083, +91-8085782471
Email: autommensor@gmail.com
WhatsApp Support Available`
};

async function updateData() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        let trainingData = await BusinessInfo.findOne();

        if (trainingData) {
            console.log('Updating existing training data...');
            Object.assign(trainingData, data);
            trainingData.updatedAt = Date.now();
            await trainingData.save();
        } else {
            console.log('Creating new training data...');
            trainingData = new BusinessInfo(data);
            await trainingData.save();
        }

        console.log('✅ Training data updated successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error updating data:', error);
        process.exit(1);
    }
}

updateData();
