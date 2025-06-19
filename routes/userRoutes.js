const express = require('express');
const { registerUser, loginUser, logoutUser , getMe, verifyAccount , forgotPassword, resetPassword} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();


router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', protect(), logoutUser); 
router.get('/me', protect(), getMe); 

router.post('/verify-account', verifyAccount);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);


module.exports = router;