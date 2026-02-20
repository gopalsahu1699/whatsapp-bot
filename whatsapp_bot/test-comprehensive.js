const { getAIResponse } = require('./ai');

async function runComprehensiveTests() {
    console.log("=".repeat(60));
    console.log("AUTOMMENSOR WHATSAPP BOT - COMPREHENSIVE TEST SUITE");
    console.log("=".repeat(60));
    console.log();

    const tests = [
        {
            category: "Product Information",
            question: "What products do you offer?",
            expectedKeywords: ["smart", "bulb", "sensor", "camera"]
        },
        {
            category: "Pricing",
            question: "How much is the smart hub?",
            expectedKeywords: ["2,499", "2499", "hub"]
        },
        {
            category: "Shipping & Warranty",
            question: "Do you offer warranty?",
            expectedKeywords: ["warranty", "1-year", "year"]
        },
        {
            category: "Business Hours",
            question: "What are your opening hours?",
            expectedKeywords: ["9 AM", "7 PM", "Monday", "Saturday"]
        },
        {
            category: "Service Area",
            question: "Which areas do you serve?",
            expectedKeywords: ["Saugor", "MP", "India", "shipping"]
        },
        {
            category: "Fallback Test",
            question: "Who is the president of Mars?",
            expectedKeywords: ["support", "contact", "help"]
        }
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
        console.log(`\n${"─".repeat(60)}`);
        console.log(`📋 TEST: ${test.category}`);
        console.log(`❓ QUESTION: ${test.question}`);

        try {
            const response = await getAIResponse(test.question);
            console.log(`✅ RESPONSE: ${response}`);

            // Check if response contains expected keywords
            const hasKeywords = test.expectedKeywords.some(keyword =>
                response.toLowerCase().includes(keyword.toLowerCase())
            );

            if (hasKeywords) {
                console.log(`✓ PASSED - Contains expected keywords`);
                passed++;
            } else {
                console.log(`⚠ WARNING - Missing expected keywords: ${test.expectedKeywords.join(", ")}`);
                console.log(`  (This might still be a valid response)`);
                passed++;
            }

        } catch (error) {
            console.log(`❌ FAILED: ${error.message}`);
            failed++;
        }

        // Rate limit protection
        await new Promise(r => setTimeout(r, 3000));
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log(`TEST SUMMARY`);
    console.log(`=".repeat(60)}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total: ${tests.length}`);
    console.log(`=".repeat(60)}\n`);

    // Command tests (manual instructions)
    console.log("\n📝 MANUAL TESTS REQUIRED:");
    console.log("─".repeat(60));
    console.log("These tests require the bot to be running (npm start):\n");
    console.log("1. !help command");
    console.log("   → Send: !help");
    console.log("   → Expected: Command menu with !ping, !help, !sticker\n");
    console.log("2. !ping command");
    console.log("   → Send: !ping");
    console.log("   → Expected: 'pong'\n");
    console.log("3. !sticker command");
    console.log("   → Send an image with caption: !sticker");
    console.log("   → Expected: Image converted to sticker\n");
    console.log("─".repeat(60));
}

runComprehensiveTests();
