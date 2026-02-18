const { GoogleGenerativeAI } = require("@google/generative-ai");
const { BusinessInfo } = require('./models');

// Load API key from environment variables for security
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Use the standard model identifier from the available models list
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

async function getAIResponse(userMessage) {
    try {
        // Fetch business info from MongoDB
        const businessData = await BusinessInfo.findOne() || {};

        // Construct context from data
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

        if (!result || !result.response) {
            throw new Error("Empty response from Gemini API");
        }

        const response = await result.response;
        const text = response.text();
        return text || "I'm listening, but I couldn't formulate a response. Could you rephrase that?";

    } catch (error) {
        console.error("Error generating AI response:", error);

        // Handle specific error cases if needed
        if (error.message && error.message.includes('model not found')) {
            return "Bot configuration error: AI model not found. Please contact the administrator.";
        }

        return "Sorry, I'm having trouble thinking right now. Please try again later.";
    }
}

module.exports = { getAIResponse };
