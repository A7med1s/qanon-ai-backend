// backend/routes/documentAnalysisRoutes.js

const express = require('express');
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const {
    summarizeText,
    extractInformation,
    rephraseText
} = require('../controllers/documentAnalysisController');

const router = express.Router();

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
 
        const fs = require('fs'); 
        const path = require('path');
        const uploadDir = path.join(__dirname, '..', 'uploads'); 

        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, './uploads');
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

router.post('/summarize', protect('basic'), upload.single('file'), summarizeText); 
router.post('/extract-info', protect('basic'), upload.single('file'), extractInformation);
router.post('/rephrase-text', protect('basic'), upload.single('file'), rephraseText);

module.exports = router;