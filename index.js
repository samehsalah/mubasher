// valid-middleware.js
const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// 1. CONFIGURATION
const FRESHCHAT_API_URL = 'mubasher-org-9f0a8757ffd299f17171516.freshchat.com/v2'
const FRESHCHAT_API_KEY = 'eyJraWQiOiJjdXN0b20tb2F1dGgta2V5aWQiLCJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJmcmVzaGNoYXQiLCJhdWQiOiJmcmVzaGNoYXQiLCJpYXQiOjE3NDcwMzg1NDQsInNjb3BlIjoiYWdlbnQ6cmVhZCBhZ2VudDpjcmVhdGUgYWdlbnQ6dXBkYXRlIGFnZW50OmRlbGV0ZSBjb252ZXJzYXRpb246Y3JlYXRlIGNvbnZlcnNhdGlvbjpyZWFkIGNvbnZlcnNhdGlvbjp1cGRhdGUgbWVzc2FnZTpjcmVhdGUgbWVzc2FnZTpnZXQgYmlsbGluZzp1cGRhdGUgcmVwb3J0czpmZXRjaCByZXBvcnRzOmV4dHJhY3QgcmVwb3J0czpyZWFkIHJlcG9ydHM6ZXh0cmFjdDpyZWFkIGFjY291bnQ6cmVhZCBkYXNoYm9hcmQ6cmVhZCB1c2VyOnJlYWQgdXNlcjpjcmVhdGUgdXNlcjp1cGRhdGUgdXNlcjpkZWxldGUgb3V0Ym91bmRtZXNzYWdlOnNlbmQgb3V0Ym91bmRtZXNzYWdlOmdldCBtZXNzYWdpbmctY2hhbm5lbHM6bWVzc2FnZTpzZW5kIG1lc3NhZ2luZy1jaGFubmVsczptZXNzYWdlOmdldCBtZXNzYWdpbmctY2hhbm5lbHM6dGVtcGxhdGU6Y3JlYXRlIG1lc3NhZ2luZy1jaGFubmVsczp0ZW1wbGF0ZTpnZXQgZmlsdGVyaW5ib3g6cmVhZCBmaWx0ZXJpbmJveDpjb3VudDpyZWFkIHJvbGU6cmVhZCBpbWFnZTp1cGxvYWQiLCJ0eXAiOiJCZWFyZXIiLCJjbGllbnRJZCI6ImZjLTRhYTc0NjY3LTJmNzYtNGE2OS04MTFmLTExZGMxODBjNDFiNiIsInN1YiI6ImJmMzc3YjJhLTkzMTktNDQ5OS1iZGZlLTlmNjIxYmQ3NTNlYSIsImp0aSI6IjZiMGRiZjExLWY4OWUtNDE1MS1hZWQ1LTIwMWE4ODFkNzI3NCIsImV4cCI6MjA2MjU3MTM0NH0.7bzTPNpcGw7Q65OPkLYFVBrZDa1wALp-8x2QHKunGBA';
const GEMINI_API_KEY = 'AIzaSyCkprPQa_AGrMv3YZP2_nAYYmqhaWZXIZo';

app.post('/freshchat-webhook', async (req, res) => {
    console.log("Incoming Webhook:", JSON.stringify(req.body)); // Log the payload for debugging
    res.status(200).send('OK'); // Always reply OK immediately

    const body = req.body;
    let userMessage = "";
    let conversationId = "";
    let actorType = "";

    try {
        // PARSE FRESHCHAT DATA
        // Check if this is a "Message Create" event
        if (body.action === 'message_create') {
            actorType = body.actor.actor_type;
            if (actorType !== 'user') return; // Ignore bot/agent messages

            // Extract the text and conversation ID
            userMessage = body.data.message.message_parts[0].text.content;
            conversationId = body.data.message.conversation_id;
        } else {
            // If it's not a message (e.g., typing indicator), ignore it
            return;
        }

        console.log(`User (${conversationId}): ${userMessage}`);

        // SEND TO GEMINI
        const geminiResponse = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
            {
                contents: [{ parts: [{ text: userMessage }] }]
            }
        );

        const aiText = geminiResponse.data.candidates[0].content.parts[0].text;

        // SEND REPLY BACK TO FRESHCHAT
        await axios.post(
            `${FRESHCHAT_API_URL}/conversations/${conversationId}/messages`,
            {
                actor_type: "agent",
                actor_id: "bot", // Generic bot ID
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
        console.log(`Replied to ${conversationId}`);

    } catch (error) {
        console.error("Error:", error.response?.data || error.message);
    }
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
module.exports = app;
