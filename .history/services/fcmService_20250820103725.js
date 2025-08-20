const axios = require('axios');
const jwt = require('jsonwebtoken');
const serviceAccount = require('../config/firebase-service-account.json');
const { db, admin } = require('../firebaseInit');
const FIREBASE_PROJECT_ID = 'aldrich-45226';

// Function to generate Firebase access token
function getFirebaseAccessToken() {
    const jwtPayload = {
        iss: serviceAccount.client_email,
        sub: serviceAccount.client_email,
        aud: 'https://oauth2.googleapis.com/token',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
    };

    const token = jwt.sign(jwtPayload, serviceAccount.private_key, { algorithm: 'RS256' });

    return axios.post('https://oauth2.googleapis.com/token', null, {
        params: {
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: token,
        },
    }).then(response => response.data.access_token);
}

// Function to send FCM notification
async function sendFcmNotification(token, title, body, imageUrl = null) {
    const accessToken = await getFirebaseAccessToken();

    const notification = {
        title: title,
        body: body,
    };

    // Add image to notification if provided
    if (imageUrl) {
        notification.image = imageUrl;
    }

    const fcmMessage = {
        message: {
            token: token,
            notification: notification,
            android: {
                priority: 'high',
                notification: {
                    ...(imageUrl && { image: imageUrl }),
                    click_action: 'FLUTTER_NOTIFICATION_CLICK'
                },
            },
            apns: {
                headers: {
                    'apns-priority': '10',
                },
                payload: {
                    aps: {
                        alert: {
                            title: title,
                            body: body,
                        },
                        'mutable-content': 1,
                        sound: 'default',
                    },
                    ...(imageUrl && { 
                        'media-url': imageUrl,
                        'fcm_options': {
                            image: imageUrl
                        }
                    }),
                },
            },
            webpush: {
                notification: {
                    title: title,
                    body: body,
                    ...(imageUrl && { image: imageUrl }),
                    requireInteraction: true,
                },
                fcm_options: {
                    link: imageUrl
                }
            },
            data: {
                title: title,
                body: body,
                ...(imageUrl && { image: imageUrl }),
                click_action: 'FLUTTER_NOTIFICATION_CLICK'
            }
        },
    };

    try {
        const response = await axios.post(
            `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`,
            fcmMessage,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        console.log('FCM Response:', response.data);
        return response.data;
    } catch (error) {
        console.error('FCM Error Details:', error.response?.data || error.message);
        throw error;
    }
}

// Function to send batch FCM notifications
async function sendBatchFcmNotifications(tokens, userIds, title, body, imageUrl = null) {
    const accessToken = await getFirebaseAccessToken();
    const results = [];

    console.log('Sending batch notifications with image URL:', imageUrl);

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const userId = userIds[i];

        try {
            const notification = {
                title: title,
                body: body,
            };

            // Add image to notification if provided
            if (imageUrl) {
                notification.image = imageUrl;
            }

            const fcmMessage = {
                message: {
                    token: token,
                    notification: notification,
                    android: {
                        priority: 'high',
                        notification: {
                            ...(imageUrl && { image: imageUrl }),
                            click_action: 'FLUTTER_NOTIFICATION_CLICK',
                            sound: 'default',
                            channel_id: 'default'
                        },
                    },
                    apns: {
                        headers: {
                            'apns-priority': '10',
                        },
                        payload: {
                            aps: {
                                alert: {
                                    title: title,
                                    body: body,
                                },
                                'mutable-content': 1,
                                sound: 'default',
                            },
                            ...(imageUrl && { 
                                'media-url': imageUrl,
                                'fcm_options': {
                                    image: imageUrl
                                }
                            }),
                        },
                    },
                    webpush: {
                        notification: {
                            title: title,
                            body: body,
                            ...(imageUrl && { image: imageUrl }),
                            requireInteraction: true,
                        },
                        fcm_options: {
                            ...(imageUrl && { link: imageUrl })
                        }
                    },
                    data: {
                        title: title,
                        body: body,
                        ...(imageUrl && { image: imageUrl }),
                        click_action: 'FLUTTER_NOTIFICATION_CLICK'
                    }
                },
            };

            console.log(`Sending FCM message for user ${userId}:`, JSON.stringify(fcmMessage, null, 2));

            const response = await axios.post(
                `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`,
                fcmMessage,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            // Save notification details to Firestore
            const notificationData = {
                title: title,
                body: body,
                ...(imageUrl && { imageUrl }), // Only include imageUrl if it is defined
                isRead: false,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            };

            await db
                .collection('notificationHistory')
                .doc(userId)
                .collection('notifications')
                .add(notificationData);

            results.push({ token, userId, success: true, data: response.data });
        } catch (error) {
            console.error(`FCM Error for token ${token}:`, error.response?.data || error.message);
            results.push({ token, userId, success: false, error: error.response?.data || error.message });
        }
    }

    return results;
}

module.exports = { sendFcmNotification, sendBatchFcmNotifications };
