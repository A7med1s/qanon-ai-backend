const User = require('../models/User');
const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const { sendVerificationEmail, sendResetPasswordEmail } = require('../services/emailService');

const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password, phone } = req.body;

    const emailExists = await User.findOne({ email });
    if (emailExists) {
        res.status(400);
        throw new Error('User with that email already exists.');
    }

    if (phone) {
        const phoneExists = await User.findOne({ phone });
        if (phoneExists) {
            res.status(400);
            throw new Error('User with that phone number already exists.');
        }
    }
    
    const user = new User({
        name,
        email,
        password, 
        phone: phone || null,
        isVerified: false,
    });

    const verificationCode = crypto.randomBytes(3).toString('hex').toUpperCase();
    const verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000); 

    user.verificationCode = verificationCode;
    user.verificationCodeExpires = verificationCodeExpires;

    const createdUser = await user.save();

    if (createdUser) {
        await sendVerificationEmail(createdUser.email, verificationCode);

        res.status(201).json({
            _id: createdUser._id,
            name: createdUser.name,
            email: createdUser.email,
            phone: createdUser.phone,
            role: createdUser.role,
            subscriptionStatus: createdUser.subscriptionStatus,
            message: 'Registration successful. Please check your email for the activation code to verify your account.'
        });
    } else {
        res.status(400);
        throw new Error('Invalid user data.');
    }
});



const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
        res.status(401);
        throw new Error('Invalid email or password.');
    }

    if (!user.isVerified) {
        res.status(401);
        throw new Error('Account not verified. Please check your email for the activation code.');
    }

    if (await user.matchPassword(password)) {
        const sessionId = crypto.randomBytes(16).toString('hex');

        if (user.activeSessions.length >= user.maxConcurrentSessions) {
            res.status(403);
            throw new Error(`Maximum number of active sessions (${user.maxConcurrentSessions}) reached.`);
        }

        user.activeSessions.push(sessionId);
        await user.save();

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            subscriptionStatus: user.subscriptionStatus,
            token: user.generateAuthToken(),
            sessionId: sessionId
        });
    } else {
        res.status(401);
        throw new Error('Invalid email or password.');
    }
});



const logoutUser = asyncHandler(async (req, res) => {
    const { sessionId } = req.body;

    if (req.user && sessionId) {
        req.user.activeSessions = req.user.activeSessions.filter(id => id !== sessionId);
        await req.user.save();
        res.status(200).json({ message: 'Logged out successfully.' });
    } else {
        res.status(400);
        throw new Error('Invalid user or session ID provided.');
    }
});


const getMe = asyncHandler(async (req, res) => {
    if (req.user) {
        res.status(200).json({
            _id: req.user._id,
            name: req.user.name,
            email: req.user.email,
            phone: req.user.phone,
            role: req.user.role,
            isVerified: req.user.isVerified, 
            subscriptionStatus: req.user.subscriptionStatus,
            subscriptionEndDate: req.user.subscriptionEndDate,
            tokensConsumed: req.user.tokensConsumed,
            monthlyTokenQuota: req.user.monthlyTokenQuota, 
            maxConcurrentSessions: req.user.maxConcurrentSessions,
        });
    } else {
        res.status(404);
        throw new Error('User not found.');
    }
});

const verifyAccount = asyncHandler(async (req, res) => {
    const { email, verificationCode } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
        res.status(404);
        throw new Error('User not found.');
    }
    if (user.isVerified) {
        res.status(400);
        throw new Error('Account already verified.');
    }
    if (user.verificationCode !== verificationCode || user.verificationCodeExpires < new Date()) {
        res.status(400);
        throw new Error('Invalid or expired verification code.');
    }

    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

    res.status(200).json({ message: 'Account verified successfully. You can now log in.' });
});


const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
        res.status(404);
        throw new Error('User with that email not found.');
    }

    const resetCode = crypto.randomBytes(3).toString('hex').toUpperCase();
    user.resetPasswordCode = resetCode;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); 
    await user.save();
    
    await sendResetPasswordEmail(user.email, resetCode);

    res.status(200).json({ message: 'Password reset code sent to your email.' });
});


const resetPassword = asyncHandler(async (req, res) => {
    const { email, resetCode, newPassword } = req.body;

    const user = await User.findOne({
        email,
        resetPasswordCode: resetCode,
        resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
        res.status(400);
        throw new Error('Invalid or expired reset code.');
    }

    user.password = newPassword;
    user.resetPasswordCode = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ message: 'Password has been reset successfully.' });
});


module.exports = {
    registerUser,
    loginUser,
    logoutUser,
    getMe,
    verifyAccount,
    forgotPassword,
    resetPassword,
};