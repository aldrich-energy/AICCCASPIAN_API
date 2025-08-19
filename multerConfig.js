const multer = require('multer');
const path = require('path');

// Define storage configuration
const storage = multer.diskStorage({
  // Specify the destination directory where files will be stored
  destination: function (req, file, cb) {
    // Use absolute path to your project directory
    const uploadPath = '/root/projects/MEICAEXPO-API/uploads';
    cb(null, uploadPath);
  },
  // Define how files should be named
  filename: function (req, file, cb) {
    // Generate a unique suffix to append to the original filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // Use the original file extension
    const fileExtension = path.extname(file.originalname);
    // Combine the unique suffix and the original file extension
    const uniqueFilename = uniqueSuffix + fileExtension;
    // Pass the unique filename to the callback
    cb(null, uniqueFilename);
  }
});

// Add file filter for security (optional but recommended)
const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Initialize multer with the storage configuration
const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

module.exports = upload;
