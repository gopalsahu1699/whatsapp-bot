const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function listModels() {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // We can't use listModels directly on genAI instance in some versions, 
        // but we can try to find the correct way for this library version.
        // Actually, the easiest way is to try a known alternative or use the listModels tool if available.
        // But I'll stick to a node script.

        // In @google/generative-ai, there isn't a simple listModels on the GenAI object.
        // It's usually through the REST API or we just try a few common ones.

        console.log("Testing models for key starting with:", process.env.GEMINI_API_KEY.substring(0, 10));

        const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro", "gemini-1.0-pro"];

        for (const m of modelsToTry) {
            try {
                const model = genAI.getGenerativeModel({ model: m });
                const result = await model.generateContent("test");
                console.log(`✅ Model ${m} is working!`);
                process.exit(0); // Exit on first success
            } catch (err) {
                console.log(`❌ Model ${m} failed:`, err.status || err.message);
            }
        }
    } catch (error) {
        console.error("Listing failed:", error);
    }
}

listModels();
