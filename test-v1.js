require('dotenv').config();

async function testV1() {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        // gemini-1.5-flash is available on v1
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: "Hello" }]
                }]
            })
        });

        const data = await response.json();
        if (data.candidates) {
            console.log("✅ Success with v1 endpoint!");
            console.log("Response:", data.candidates[0].content.parts[0].text);
            process.exit(0);
        } else {
            console.error("❌ v1 failed:", JSON.stringify(data, null, 2));
            process.exit(1);
        }
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}

testV1();
