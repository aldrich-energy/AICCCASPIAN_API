// helloWorldRoutes.js
const express = require('express');
const router = express.Router();

// Define the GET /hello-world route
router.get('/hello-world', (req, res) => {
    res.json({ message: 'Hello, MECOC EXPO!' });
});

module.exports = router;
