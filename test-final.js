const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function testFinal() {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // Let's try gemini-2.0-flash-exp if available, or just gemini-pro
        const m = "gemini-1.5-flash-latest"; // Try the 'latest' alias
        console.log(`Testing model: ${m}`);
        const model = genAI.getGenerativeModel({ model: m });
        const result = await model.generateContent("Hello");
        const response = await result.response;
        console.log(`✅ Success with ${m}: ${response.text()}`);
        process.exit(0);
    } catch (error) {
        console.error(`❌ Failed with ${error.status}: ${error.message}`);
        process.exit(1);
    }
}

testFinal();
