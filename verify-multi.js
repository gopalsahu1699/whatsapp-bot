const mongoose = require('mongoose');
require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function verify() {
    try {
        console.log('Key starts with:', process.env.GEMINI_API_KEY.substring(0, 10));
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"];
        let workingModel = null;

        for (const m of modelsToTry) {
            try {
                const model = genAI.getGenerativeModel({ model: m });
                const result = await model.generateContent("Say 'Hello'");
                const response = await result.response;
                console.log(`✅ Model ${m} is working! Response: ${response.text()}`);
                workingModel = m;
                break;
            } catch (err) {
                console.log(`❌ Model ${m} failed: ${err.status || err.message}`);
            }
        }

        if (workingModel) {
            console.log(`Found working model: ${workingModel}`);
            process.exit(0);
        } else {
            console.error("No working models found.");
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    }
}

verify();
