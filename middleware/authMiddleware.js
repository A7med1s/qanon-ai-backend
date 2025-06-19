const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');

const protect = (requiredSubscription = null) => asyncHandler(async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];

            const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user) {
                res.status(401);
                throw new Error('Not authorized, user not found.');
            }

            if (requiredSubscription) {
                const subscriptionLevels = ['free', 'basic', 'premium', 'corporate'];
                const userLevelIndex = subscriptionLevels.indexOf(req.user.subscriptionStatus);
                const requiredLevelIndex = subscriptionLevels.indexOf(requiredSubscription);

                if (userLevelIndex < requiredLevelIndex) {
                    res.status(403);
                    throw new Error(`Not authorized, ${requiredSubscription} subscription required to access this tool.`);
                }

              if (req.user.subscriptionStatus !== 'free' && req.user.subscriptionEndDate && req.user.subscriptionEndDate < new Date()) {
    req.user.subscriptionStatus = 'free';
    req.user.subscriptionEndDate = undefined;
    req.user.tokensConsumed = 0; 
    await req.user.save();
    res.status(403);
    throw new Error('Your subscription has expired. Please renew to access this tool.');
}
            }
            next(); 

        } catch (error) {
            if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
                res.status(401);
                throw new Error('Not authorized, invalid or expired token.');
            } else if (res.statusCode === 403) {
                throw error;
            } else {
                res.status(500);
                throw new Error('An unexpected authentication error occurred.');
            }
        }
    } else {
        res.status(401);
        throw new Error('Not authorized, no token.');
    }
});

module.exports = { protect };