// backend/routes/legalQnARoutes.js
const express = require('express');
const multer = require('multer'); // **استيراد multer هنا**
const { protect } = require('../middleware/authMiddleware');
const { askLegalQuestion } = require('../controllers/legalQnAController');

const router = express.Router();

// **إعداد Multer لتخزين الملفات في الذاكرة (Memory Storage)**
// بما إن Cloud Functions مابتقدرش تكتب على الـ Disk
const storage = multer.memoryStorage(); // **استخدم memoryStorage()**
const upload = multer({ storage: storage }); // **استخدم الـ storage اللي عرفناه**

// مسار سؤال/إجابة قانوني
router.post('/ask', protect('basic'), upload.none(), askLegalQuestion); // **تم التعديل هنا**

module.exports = router;
