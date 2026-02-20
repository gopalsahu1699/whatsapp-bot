const { GoogleGenerativeAI } = require("@google/generative-ai");

// Use the same key as ai.js
const genAI = new GoogleGenerativeAI("AIzaSyAMLxgHS7kmh0hax8LYpmhUTSCn7-lr_PY");

async function listModels() {
    try {
        // Unfortunately the Node SDK might not expose listModels directly on the main class easily in all versions.
        // But let's try accessing the model manager if possible or use a simple fetch if needed.
        // Actually, the SDK *does* have it via `getGenerativeModel`? No.
        // Let's try to infer it or just try a standard `gemini-1.0-pro`.

        // Wait, the SDK has a `makeRequest` or similar?
        // Checking documentation memory... `genAI.getGenerativeModel` is the main entry.
        // Listing models usually requires `fetch`.

        const apiKey = "AIzaSyAMLxgHS7kmh0hax8LYpmhUTSCn7-lr_PY";
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.models) {
            console.log("Available Models:");
            data.models.forEach(m => console.log(`- ${m.name}`));
        } else {
            console.error("No models found or error:", data);
        }

    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
