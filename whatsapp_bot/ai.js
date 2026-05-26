require('dotenv').config();
const OpenAI = require("openai");
const { supabase } = require('./supabase');


// Initialize OpenAI client with NVIDIA's base URL and API key
const openai = new OpenAI({
    apiKey: process.env.NVIDIA_API_KEY,
    baseURL: process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1"
});

const MODEL_NAME = process.env.NVIDIA_MODEL_NAME || "nvidia/nemotron-3-nano-30b-a3b";

async function getAIResponse(userMessage) {
    try {
        // Fetch business info from Supabase (may be empty or placeholder)
        let businessData;
        try {
            const { data, error } = await supabase.from('business_info').select('*').single();
            if (error) {
                console.warn('Supabase fetch failed for BusinessInfo:', error.message);
                businessData = {};
            } else {
                businessData = data;
            }
        } catch (dbErr) {
            console.warn('Supabase fetch exception for BusinessInfo:', dbErr.message);
            businessData = {};
        }
        // If data appears to be placeholder (short strings) or empty, load from local JSON
        const isPlaceholder = businessData && (
            (!businessData.about_us || businessData.about_us.length < 20) &&
            (!businessData.products || businessData.products.length < 20)
        );
        if (!businessData || Object.keys(businessData).length === 0 || isPlaceholder) {
            try {
                const fs = require('fs').promises;
                const path = require('path');
                const filePath = path.join(__dirname, 'business_info.json');
                const raw = await fs.readFile(filePath, 'utf8');
                businessData = JSON.parse(raw);
            } catch (fallbackErr) {
                console.warn('Failed to load local business_info.json fallback:', fallbackErr.message);
                businessData = {};
            }
        }

        // Construct context from data
        const contextLines = [
            `My Business Name: Autommensor`,
            `About Us:\n${businessData.about_us || ''}`,
            `Products/Services:\n${businessData.products || ''}`,
            `Frequently Asked Questions (FAQ):\n${businessData.faq || ''}`,
            `Refund Policy:\n${businessData.refund_policy || ''}`,
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

async function getCampaignAdvice(campaignStats) {
    try {
        // Fetch business info from Supabase with fallback to local file
        let businessData;
        try {
            const { data, error } = await supabase
                .from('business_info')
                .select('*')
                .single();
            if (error) throw error;
            businessData = data;
        } catch (dbErr) {
            console.warn("Supabase fetch failed for BusinessInfo in getCampaignAdvice, loading from business_info.json fallback:", dbErr.message);
        }
        if (!businessData) {
            try {
                const fs = require('fs').promises;
                const path = require('path');
                const data = await fs.readFile(path.join(__dirname, 'business_info.json'), 'utf8');
                businessData = JSON.parse(data);
            } catch (fileErr) {
                console.error("Failed to read business_info.json fallback in getCampaignAdvice:", fileErr.message);
                businessData = {};
            }
        }


        const contextLines = [
            `My Business Name: Autommensor`,
            `About Us:\n${businessData.aboutUs || ''}`,
            `Products/Services:\n${businessData.products || ''}`
        ];
        const contextString = contextLines.join('\n\n');

        const systemPrompt = `You are an expert AI Marketing & Growth Advisor for a business called Autommensor.
Your goal is to look at the recent WhatsApp marketing campaign statistics and provide actionable, specific advice on how to improve engagement, reduce failure rates, and grow the business.
Keep your answer structured with bullet points. Be encouraging but analytical. Do not make up fake data.

--- BUSINESS INFORMATION ---
${contextString}
----------------------------

--- CAMPAIGN STATS TO ANALYZE ---
${JSON.stringify(campaignStats, null, 2)}
---------------------------------`;

        const completion = await openai.chat.completions.create({
            model: MODEL_NAME,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: "Based on these campaign results, what is your opinion on our performance and what 3 actionable steps should we take to grow our business?" }
            ],
            temperature: 0.7,
            max_tokens: 1500,
        });

        return completion.choices[0].message.content;

    } catch (error) {
        console.error("Error generating AI Campaign Advice:", error);
        return "Sorry, the AI Growth Advisor is currently unavailable. Please try again later.";
    }
}

module.exports = { getAIResponse, getCampaignAdvice };
