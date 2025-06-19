const express = require('express');
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const {
    createContract,
    rephraseContract
} = require('../controllers/contractManagementController');

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

router.post('/create-contract', protect('basic'), upload.single('file'), createContract);
router.post('/rephrase-contract', protect('basic'), upload.single('file'), rephraseContract);

module.exports = router;