const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const FRESHCHAT_API_URL = process.env.FRESHCHAT_API_URL || 'https://api.freshchat.com/v2';
const FRESHCHAT_API_KEY = process.env.FRESHCHAT_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.post('/freshchat-webhook', async (req, res) => {
    // 1. Log the incoming event for debugging
    console.log("Incoming Webhook Event:", req.body.action); 
    
    // Always reply OK immediately to Freshchat to prevent timeouts
    res.status(200).send('OK');

    const body = req.body;
    let userMessage = "";
    let conversationId = "";
    let actorType = "";

    try {
        // 2. CHECK: Only process "message_create" events
        // The log you sent showed "conversation_resolution" - we must IGNORE that or the bot crashes.
        if (body.action !== 'message_create') {
            console.log(`Ignoring event type: ${body.action}`);
            return;
        }

        // 3. CHECK: Only process messages from "user" (not bot)
        actorType = body.actor.actor_type;
        if (actorType !== 'user') {
            console.log(`Ignoring message from actor: ${actorType}`);
            return; 
        }

        // 4. Extract Data
        if (body.data && body.data.message && body.data.message.message_parts) {
            userMessage = body.data.message.message_parts[0].text.content;
            conversationId = body.data.message.conversation_id;
        } else {
            console.log("Message content not found in payload.");
            return;
        }

        console.log(`Processing User Message: "${userMessage}"`);

        // 5. SEND TO GOOGLE GEMINI (Updated Model: gemini-1.5-flash)
        const geminiResponse = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                contents: [{ parts: [{ text: userMessage }] }]
            }
        );

        const aiText = geminiResponse.data.candidates[0].content.parts[0].text;
        console.log(`Gemini Reply: "${aiText}"`);

        // 6. SEND REPLY BACK TO FRESHCHAT
        await axios.post(
            `${FRESHCHAT_API_URL}/conversations/${conversationId}/messages`,
            {
                actor_type: "agent",
                actor_id: "bot", 
                message_type: "normal",
                message_parts: [{ text: { content: aiText } }]
            },
            {
                headers: {
                    'Authorization': `Bearer ${FRESHCHAT_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log("Successfully sent reply to Freshchat.");

    } catch (error) {
        console.error("Error Processing Request:");
        if (error.response) {
            console.error("API Error Data:", JSON.stringify(error.response.data));
        } else {
            console.error("Error Message:", error.message);
        }
    }
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
module.exports = app;
