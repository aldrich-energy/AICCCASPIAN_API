const express = require('express');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const path = require('path');
const app = express();
const upload = require('./multerConfig'); // Import the multer configuration

app.use(express.json());

// Initialize Firebase Admin
require('./firebaseInit');

// Configure CORS
const corsOptions = {
  origin: '*',
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key'],
};

app.use(cors(corsOptions));

// Define your default API key (use environment variables in production)
const DEFAULT_API_KEY = '3ePRGYIWfTfZAt4Fl6u33G6YePJrGrce8fpRVJgKQIryR5giFL0vCK2sz4VcwMgQ';

// Middleware to check API key
function checkApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== DEFAULT_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
    }
    next();
}

// Apply the middleware globally (to all routes)
app.use(checkApiKey);

// Serve static files from the 'uploads' directory using absolute path
const uploadsPath = '/root/projects/MEICAEXPO-API/uploads';
app.use('/uploads', express.static(uploadsPath));

// Import modular routes
const helloWorldRoutes = require('./routes/helloWorldRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

// Use the routes
app.use('/', helloWorldRoutes); // Routes for /hello-world
app.use('/', notificationRoutes); // Routes for /send-notification

// Define a route to handle file uploads
app.post('/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    // Construct the URL of the uploaded image
    const imageUrl = https://api.aldrich-energy.com/uploads/${req.file.filename};

    // Send a response with the image URL
    res.json({
      success: true,
      message: 'File uploaded successfully!',
      imageUrl: imageUrl,
      filename: req.file.filename,
      size: req.file.size
    });
  } catch (error) {
    console.error('Error uploading file:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to upload file',
      details: error.message
    });
  }
});

// Add a health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uploadsPath: uploadsPath
  });
});

// Import and start the background task
require('./backgroundTasks');

// Comment out the SSL part for running it temporarily
/*
// Load SSL certificates
const privateKey = fs.readFileSync('/etc/letsencrypt/live/api.aldrich-energy.com/privkey.pem', 'utf8');
const certificate = fs.readFileSync('/etc/letsencrypt/live/api.aldrich-energy.com/fullchain.pem', 'utf8');
const credentials = { key: privateKey, cert: certificate };
*/

// Create HTTP server instead of HTTPS
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(Server is running on port ${PORT});'
    console.log(Uploads directory: ${uploadsPath});
    console.log(Static files served at: http://localhost:${PORT}/uploads/);
});