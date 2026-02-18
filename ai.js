const OpenAI = require("openai");
const { BusinessInfo } = require('./models');

// Initialize OpenAI client with NVIDIA's base URL and API key
const openai = new OpenAI({
    apiKey: process.env.NVIDIA_API_KEY,
    baseURL: process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1"
});

const MODEL_NAME = process.env.NVIDIA_MODEL_NAME || "nvidia/nemotron-3-nano-30b-a3b";

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
        const systemPrompt = `You are a helpful customer support assistant for a business called Autommensor.
Use the provided business information to answer the user's question.
If the answer is not in the information, politely ask them to contact support.
Do not make up facts. Keep answers concise and friendly.

--- BUSINESS INFORMATION ---
${contextString}
----------------------------`;

        const completion = await openai.chat.completions.create({
            model: MODEL_NAME,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage }
            ],
            temperature: 0.5,
            max_tokens: 1024,
        });

        const text = completion.choices[0].message.content;
        return text || "I'm listening, but I couldn't formulate a response. Could you rephrase that?";

    } catch (error) {
        console.error("Error generating NVIDIA AI response:", error);

        // Handle specific error cases
        if (error.status === 401) {
            return "Bot configuration error: Invalid NVIDIA API key. Please contact the administrator.";
        }
        if (error.status === 404) {
            return `Bot configuration error: NVIDIA model "${MODEL_NAME}" not found.`;
        }

        return "Sorry, I'm having trouble thinking right now. Please try again later.";
    }
}

module.exports = { getAIResponse };
