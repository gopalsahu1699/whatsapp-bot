const mongoose = require('mongoose');
require('dotenv').config();
const { getAIResponse } = require('./ai');

async function verify() {
    try {
        console.log('Connecting to MongoDB for verification...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.\n');

        const questions = [
            "What is Autommensor?",
            "What products do you offer?",
            "Is there a warranty?",
            "What is your refund policy?",
            "How can I contact support?",
            "Who is the president of the moon?"
        ];

        for (const question of questions) {
            console.log(`[USER]: ${question}`);
            const answer = await getAIResponse(question);
            console.log(`[BOT]: ${answer}\n`);
            // Small delay to avoid rate limiting
            await new Promise(r => setTimeout(r, 2000));
        }

        console.log('Verification complete.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    }
}

verify();
