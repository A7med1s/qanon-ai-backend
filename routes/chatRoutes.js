const express = require('express');
const multer = require('multer'); 
const { protect } = require('../middleware/authMiddleware');
const { sendMessage, getConversations, getConversationById } = require('../controllers/chatController');

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

router.post('/send-message', protect('basic'), upload.single('file'), sendMessage); 

router.get('/conversations', protect(), getConversations); 
router.get('/conversations/:id', protect(), getConversationById);

module.exports = router;