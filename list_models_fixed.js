require('dotenv').config();

async function listModels() {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("No API key found in .env");
            process.exit(1);
        }

        console.log("Checking models with key starting with:", apiKey.substring(0, 7));

        // Using fetch to get models list
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.models) {
            console.log("Available Models:");
            data.models.forEach(m => console.log(`- ${m.name} (Supports: ${m.supportedGenerationMethods.join(', ')})`));
        } else {
            console.error("No models return message:", data);
        }
    } catch (error) {
        console.error("Error fetching models:", error);
    }
}

listModels();
