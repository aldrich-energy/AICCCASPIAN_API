const express = require('express');
const router = express.Router();
const { sendFcmNotification, sendBatchFcmNotifications } = require('../services/fcmService');
const { db, admin } = require('../firebaseInit');
const upload = require('../multerConfig'); // Import the multer configuration

// Define the POST /send-notification route
router.post('/send-notification', async (req, res) => {
    const { token, title, body, userId } = req.body;

    if (!token || !title || !body || !userId) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
        const result = await sendFcmNotification(token, title, body);

        const notificationData = {
            title: title,
            body: body,
            isRead: false,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        };

        await db
            .collection('notificationHistory')
            .doc(userId)
            .collection('notifications')
            .add(notificationData);

        res.json({ success: true, message: 'Notification sent and stored successfully', result });
    } catch (error) {
        console.error('Error sending notification:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to send notification',
            details: error.response?.data || error.message
        });
    }
});

// Define the POST /send-batch-notifications route
router.post('/send-batch-notifications', async (req, res) => {
    let { tokens, userIds, title, body, imageUrl } = req.body;

    // Parse tokens and userIds if they come as strings (from form-data)
    try {
        if (typeof tokens === 'string') {
            tokens = JSON.parse(tokens);
        }
        if (typeof userIds === 'string') {
            userIds = JSON.parse(userIds);
        }
    } catch (parseError) {
        return res.status(400).json({
            error: 'Invalid JSON format for tokens or userIds',
            details: parseError.message
        });
    }

    // Validation
    if (!tokens || !userIds || !title || !body) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    if (!Array.isArray(tokens) || !Array.isArray(userIds)) {
        return res.status(400).json({ error: 'tokens and userIds must be arrays' });
    }

    if (tokens.length !== userIds.length) {
        return res.status(400).json({
            error: 'The number of tokens and userIds must be the same',
            tokensCount: tokens.length,
            userIdsCount: userIds.length
        });
    }

    if (tokens.length === 0) {
        return res.status(400).json({ error: 'At least one token and userId pair is required' });
    }

    console.log('Batch notification request:', {
        tokensCount: tokens.length,
        userIdsCount: userIds.length,
        title,
        body,
        imageUrl,
        hasImage: !!imageUrl
    });

    try {
        const results = await sendBatchFcmNotifications(tokens, userIds, title, body, imageUrl);

        const response = {
            success: true,
            message: 'Batch notifications sent and stored successfully',
            totalSent: results.length,
            imageUrl: imageUrl, // Include this for debugging
            results
        };

        console.log('Batch notification response:', response);
        res.json(response);
    } catch (error) {
        console.error('Error sending batch notifications:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to send batch notifications',
            details: error.response?.data || error.message
        });
    }
});


module.exports = router;
