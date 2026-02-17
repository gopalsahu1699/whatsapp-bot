const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

// Load API key from environment variables for security
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

async function getAIResponse(userMessage) {
    try {
        // Read business information dynamically from the JSON file
        const businessInfoPath = path.join(__dirname, 'business_info.json');
        let businessData = {};
        try {
            const fileContent = fs.readFileSync(businessInfoPath, 'utf8');
            businessData = JSON.parse(fileContent);
        } catch (err) {
            console.error("Error reading business_info.json:", err);
        }

        // Construct context from structured data
        const contextLines = [
            `My Business Name: Autommensor`,
            `About Us:\n${businessData.aboutUs || ''}`,
            `Products/Services:\n${businessData.products || ''}`,
            `Frequently Asked Questions (FAQ):\n${businessData.faq || ''}`,
            `Refund Policy:\n${businessData.refundPolicy || ''}`,
            `Contact:\n${businessData.contact || ''}`
        ];
        const contextString = contextLines.join('\n\n');

        // Construct the prompt with business context
        const prompt = `
        You are a helpful customer support assistant for the business described below.
        Use the provided business information to answer the user's question.
        If the answer is not in the information, politely ask them to contact support.
        Do not make up facts. Keep answers concise and friendly.

        --- BUSINESS INFORMATION ---
        ${contextString}
        ----------------------------

        User Question: ${userMessage}
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        return text;

    } catch (error) {
        console.error("Error generating AI response:", error);
        return "Sorry, I'm having trouble thinking right now. Please try again later.";
    }
}

module.exports = { getAIResponse };
