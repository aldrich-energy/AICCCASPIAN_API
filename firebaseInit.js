const admin = require('firebase-admin');
const serviceAccount = require('./config/firebase-service-account.json'); // Path to your Firebase service account JSON file

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Access Firestore
const db = admin.firestore();

module.exports = { admin, db };