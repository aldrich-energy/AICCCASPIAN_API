const cron = require('node-cron');
const { db, admin } = require('./firebaseInit'); // Import db and admin
const { sendFcmNotification } = require('./services/fcmService');
const moment = require('moment-timezone'); // Import moment-timezone

// Set the time zone to GST (Asia/Dubai)
const TIME_ZONE = 'Asia/Dubai';

// Track scheduled notifications in memory
const scheduledNotifications = new Set();

// Lock to prevent overlapping cron jobs
let isRunning = false;

// Helper function to parse time in "11:00 AM" format and convert to GST
function parseTime(timeString, date, timeZone) {
    // Combine the date and time into a single string
    const dateTimeString = `${date} ${timeString}`;

    // Parse the date and time in the specified time zone (GST)
    const localTime = moment.tz(dateTimeString, 'YYYY-MM-DD h:mm A', timeZone);

    return localTime.toDate();
}

// Function to schedule notifications for events
async function scheduleNotifications() {
    if (isRunning) {
        console.log('Previous job is still running. Skipping this execution.');
        return;
    }

    isRunning = true;

    try {
        // Get the current date in "YYYY-MM-DD" format in GST
        const currentDate = moment().tz(TIME_ZONE).format('YYYY-MM-DD');
        console.log(`Checking for notifications on date: ${currentDate} (GST)`);

        // Query the notifyMe collection for documents where date is today and userNotified is false
        const notifyMeSnapshot = await db.collection('notifyMe')
            .where('date', '==', currentDate)
            .where('userNotified', '==', false)
            .get();

        console.log(`Found ${notifyMeSnapshot.size} users to notify today.`);

        if (notifyMeSnapshot.empty) {
            console.log('No users to notify today.');
            return;
        }

        // Loop through each document in the notifyMe collection
        for (const doc of notifyMeSnapshot.docs) {
            const notifyMeData = doc.data();
            const { userId, topic, speakerName, time } = notifyMeData;

            // Parse the event time in GST
            const eventTime = parseTime(time, currentDate, TIME_ZONE);
            if (isNaN(eventTime.getTime())) {
                console.error(`Invalid time format for user ${userId}: ${time}`);
                continue;
            }

            // Calculate the notification time (10 minutes before the event) in GST
            const notificationTime = new Date(eventTime.getTime() - 10 * 60 * 1000);

            console.log(`Event time for user ${userId} (GST): ${moment(eventTime).tz(TIME_ZONE).format('YYYY-MM-DD h:mm A')}`);
            console.log(`Notification time for user ${userId} (GST): ${moment(notificationTime).tz(TIME_ZONE).format('YYYY-MM-DD h:mm A')}`);

            // Check if the notification time is in the future
            if (notificationTime > new Date()) {
                const notificationKey = `${userId}-${eventTime.getTime()}`;

                // Check if the notification is already scheduled
                if (scheduledNotifications.has(notificationKey)) {
                    console.log(`Notification already scheduled for user ${userId} at ${moment(notificationTime).tz(TIME_ZONE).format('YYYY-MM-DD h:mm A')} (GST)`);
                    continue;
                }

                // Mark the notification as scheduled
                scheduledNotifications.add(notificationKey);

                console.log(`Scheduling notification for user ${userId} at ${moment(notificationTime).tz(TIME_ZONE).format('YYYY-MM-DD h:mm A')} (GST)`);

                // Schedule the notification
                setTimeout(async () => {
                    console.log(`Triggering notification for user ${userId} at ${moment().tz(TIME_ZONE).format('YYYY-MM-DD h:mm A')} (GST)`);
                    try {
                        // Fetch the user's FCM token from the Users collection
                        const userDoc = await db.collection('Users')
                            .doc(userId)
                            .get();

                        if (!userDoc.exists) {
                            console.error(`User with ID ${userId} not found.`);
                            return;
                        }

                        const userData = userDoc.data();
                        const { fcm_token } = userData;

                        if (!fcm_token) {
                            console.error(`FCM token not found for user with ID ${userId}.`);
                            return;
                        }

                        // Send FCM notification
                        const notificationTitle = `Reminder: ${topic} Today!`;
                        const notificationBody = `Don’t miss ${speakerName} at ${time}. See you there!`;

                        await sendFcmNotification(fcm_token, notificationTitle, notificationBody);

                        // Use a transaction to update the userNotified field
                        await db.runTransaction(async (transaction) => {
                            const notifyMeRef = doc.ref;
                            const notifyMeDoc = await transaction.get(notifyMeRef);

                            if (notifyMeDoc.exists && !notifyMeDoc.data().userNotified) {
                                transaction.update(notifyMeRef, { userNotified: true });
                            }
                        });

                        // Store the notification in the notificationHistory collection
                        const notificationData = {
                            title: notificationTitle,
                            body: notificationBody,
                            userId: userId,
                            isRead: false, // Default value
                            timestamp: admin.firestore.FieldValue.serverTimestamp(), // Server-side timestamp
                        };

                        await db.collection('notificationHistory')
                            .doc(userId) // Use userId as the document ID
                            .collection('notifications') // Subcollection for notifications
                            .add(notificationData);

                        console.log(`Notification sent to user ${userId} for event at ${time} (GST)`);
                        console.log(`Notification stored in Firestore for user ${userId}.`);
                    } catch (error) {
                        console.error(`Error sending notification to user ${userId}:`, error);
                    } finally {
                        // Remove the notification from the scheduled set
                        scheduledNotifications.delete(notificationKey);
                    }
                }, notificationTime - new Date());
            } else {
                console.log(`Event for user ${userId} at ${time} has already passed.`);
            }
        }
    } catch (error) {
        console.error('Error scheduling notifications:', error);
    } finally {
        isRunning = false;
    }
}

// Function to check for missed notifications on server startup
async function checkMissedNotifications() {
    try {
        // Get the last checked timestamp from Firestore
        const lastCheckedDoc = await db.collection('cronJobStatus').doc('lastChecked').get();

        let lastCheckedTimestamp;
        if (lastCheckedDoc.exists) {
            lastCheckedTimestamp = new Date(lastCheckedDoc.data().timestamp);
        } else {
            // If no timestamp exists, set it to the beginning of the current day in GST
            const now = moment().tz(TIME_ZONE).startOf('day').toDate();
            lastCheckedTimestamp = now;
        }

        // Get the current date in GST
        const currentDate = moment().tz(TIME_ZONE).toDate();

        // Check if the last checked timestamp is before the current date
        if (lastCheckedTimestamp < currentDate) {
            console.log('Checking for missed notifications...');
            await scheduleNotifications();
        } else {
            console.log('No missed notifications.');
        }
    } catch (error) {
        console.error('Error checking for missed notifications:', error);
    }
}

// Schedule the task to run every minute
cron.schedule('* * * * *', () => {
    console.log('Running scheduled task to check and notify users at:', moment().tz(TIME_ZONE).format('YYYY-MM-DD h:mm A') + ' (GST)');
    scheduleNotifications();
});

// Check for missed notifications on server startup
checkMissedNotifications();

module.exports = { scheduleNotifications, checkMissedNotifications };