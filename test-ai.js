const { getAIResponse } = require('./ai');

async function runTests() {
    console.log("Starting AI Logic Tests...\n");

    const testQuestions = [
        "What are your opening hours?",
        // "Do you implement refund policy?",
        // "Tell me about Product A",
        // "Who is the president of the moon?" // Should trigger fallback or "not in info"
    ];

    for (const question of testQuestions) {
        console.log(`[USER]: ${question}`);
        try {
            const answer = await getAIResponse(question);
            console.log(`[BOT]: ${answer}\n`);
        } catch (error) {
            console.error(`[ERROR]: Failed to get response for "${question}"`);
            console.error(error); // Print the full error object
            if (error.response) {
                console.error("Response status:", error.response.status);
                try {
                    console.error("Response data:", await error.response.text());
                } catch (e) {
                    // ignore error
                }
            }
        }
        await new Promise(r => setTimeout(r, 5000)); // Rate limit workaround
    }
}

runTests();
