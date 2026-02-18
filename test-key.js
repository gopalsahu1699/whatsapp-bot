const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function testKey() {
    try {
        console.log("Testing API Key:", process.env.GEMINI_API_KEY ? "Present (Starts with " + process.env.GEMINI_API_KEY.substring(0, 7) + ")" : "Not found");
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Hello, are you working?");
        const response = await result.response;
        console.log("Success! Response from AI:", response.text());
        process.exit(0);
    } catch (error) {
        console.error("Test failed!");
        console.error(error);
        process.exit(1);
    }
}

testKey();
