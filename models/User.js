
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = mongoose.Schema(
    {
        name: { type: String, required: true },
        email: { type: String, required: true,lowercase: true, unique: true },
        password: { type: String, required: true },
        phone: { type: String, unique: true, sparse: true },
        isVerified: { type: Boolean, default: false },
        verificationCode: { type: String },
        verificationCodeExpires: { type: Date },
        resetPasswordCode: { type: String },
        resetPasswordExpires: { type: Date },
        subscriptionStatus: { type: String, enum: ['free', 'basic', 'premium', 'corporate'], default: 'free' },
         subscriptionEndDate: {
            type: Date,
            default: () => { 
                const oneMonthFromNow = new Date();
                oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
                return oneMonthFromNow;
            }
        },
        tokensConsumed: { type: Number, default: 0 },
        monthlyTokenQuota: { type: Number, default: 100000 },
         chatStorageUsed: { type: Number, default: 0 }, 
        chatStorageQuota: { type: Number, default: 10 },
        role: { type: String, enum: ['user', 'admin'], default: 'user' },
        settings: { type: Object, default: {} },
        activeSessions: { type: [String], default: [] },
        maxConcurrentSessions: { type: Number, default: 3 }
    },
    {
        timestamps: true,
    }
);


userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.generateAuthToken = function () {
    return jwt.sign({ id: this._id, role: this.role }, process.env.JWT_SECRET_KEY, {
        expiresIn: '30d',
    });
};

const User = mongoose.model('User', userSchema);

User.on('index', function(error) {
    if (error) console.error('Error creating user indexes:', error);
    else console.log('User indexes created successfully.');
});

module.exports = User;