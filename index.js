const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const FRESHCHAT_API_URL = process.env.FRESHCHAT_API_URL || 'https://api.freshchat.com/v2';
const FRESHCHAT_API_KEY = process.env.FRESHCHAT_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.post('/freshchat-webhook', async (req, res) => {
    console.log("Incoming Webhook Event:", req.body.action); 

    const body = req.body;
    let userMessage = "";
    let conversationId = "";

    try {
        // 1. FILTER: Only process new user messages
        if (body.action !== 'message_create') {
            // If it's not a message (e.g., typing or close), just say OK and exit
            return res.status(200).send('Ignored event');
        }

        if (body.actor.actor_type !== 'user') {
            return res.status(200).send('Ignored bot message');
        }

        // 2. EXTRACT DATA
        if (body.data && body.data.message && body.data.message.message_parts) {
            userMessage = body.data.message.message_parts[0].text.content;
            conversationId = body.data.message.conversation_id;
        } else {
            return res.status(200).send('No message content');
        }

        console.log(`Processing User Message: "${userMessage}"`);

        // 3. CALL GEMINI (We wait here!)
        // Note: We use gemini-1.5-flash because it is fast enough for webhooks
        const geminiResponse = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                contents: [{ parts: [{ text: userMessage }] }]
            }
        );

        const aiText = geminiResponse.data.candidates[0].content.parts[0].text;
        console.log(`Gemini Reply: "${aiText}"`);

        // 4. REPLY TO FRESHCHAT
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

        console.log("Successfully replied.");
        
        // 5. FINISH (Only now do we tell Vercel we are done)
        res.status(200).send('Success');

    } catch (error) {
        console.error("Error Processing Request:", error.message);
        if (error.response) {
            console.error("API Error Data:", JSON.stringify(error.response.data));
        }
        // Even if we fail, we must send a response to stop Freshchat from retrying
        res.status(200).send('Error processed');
    }
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
module.exports = app;
