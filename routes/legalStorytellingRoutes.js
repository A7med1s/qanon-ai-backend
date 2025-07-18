const express = require('express');
const multer = require('multer'); // عشان لو المستخدم رفع ملف
const { protect } = require('../middleware/authMiddleware');
const { generatePersuasionPoints } = require('../controllers/legalStorytellingController');

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

// إعداد Multer لتخزين الملفات في الذاكرة (Memory Storage)
const upload = multer({ storage: multer.memoryStorage() });

// مسار توليد نقاط الإقناع
router.post('/generate-persuasion-points', protect('basic'), upload.single('file'), generatePersuasionPoints); // ممكن يستقبل ملف

module.exports = router;