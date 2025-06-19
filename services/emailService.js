const nodemailer = require('nodemailer');
require('dotenv').config(); 

const transporter = nodemailer.createTransport({
    service: 'gmail', 
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const sendVerificationEmail = async (toEmail, verificationCode) => {
    const mailOptions = {
        from: `Qanon.ai <${process.env.EMAIL_USER}>`, 
        to: toEmail,
        subject: 'Qanon.ai - تفعيل حسابك | Account Activation',
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; text-align: right; direction: rtl;">
                <h2 style="color: #0056b3;">مرحباً بك في Qanon.ai!</h2>
                <p>شكراً لتسجيلك في منصتنا. يرجى استخدام كود التفعيل التالي لتفعيل حسابك:</p>
                
                <p style="font-size: 24px; font-weight: bold; color: #0056b3; letter-spacing: 2px; text-align: center;">${verificationCode}</p>

                <p>هذا الكود صالح لمدة 10 دقائق.</p>
                <p>إذا لم تطلب هذا التسجيل، يرجى تجاهل هذا البريد الإلكتروني.</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                <div style="text-align: left; direction: ltr;">
                    <p style="font-size: 0.8em; color: #666;">Welcome to Qanon.ai!</p>
                    <p style="font-size: 0.8em; color: #666;">Thank you for registering. Please use the following verification code to activate your account:</p>
                    
                    <p style="font-size: 24px; font-weight: bold; color: #0056b3; letter-spacing: 2px; text-align: center;">${verificationCode}</p>

                    <p style="font-size: 0.8em; color: #666;">This code is valid for 10 minutes.</p>
                    <p style="font-size: 0.8em; color: #666;">If you did not request this registration, please ignore this email.</p>
                </div>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Verification email sent to ${toEmail}`);
    } catch (error) {
        console.error(`Failed to send verification email to ${toEmail}:`, error.message);
    }
};

const sendResetPasswordEmail = async (toEmail, resetCode) => {
    const mailOptions = {
        from: `Qanon.ai <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: 'Qanon.ai - إعادة تعيين كلمة المرور | Password Reset',
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; text-align: right; direction: rtl;">
                <h2 style="color: #0056b3;">طلب إعادة تعيين كلمة المرور</h2>
                <p>تلقينا طلباً لإعادة تعيين كلمة المرور لحسابك في Qanon.ai. يرجى استخدام الكود التالي:</p>
                
                <p style="font-size: 24px; font-weight: bold; color: #0056b3; letter-spacing: 2px; text-align: center;">${resetCode}</p>
                
                <p>هذا الكود صالح لمدة 15 دقيقة.</p>
                <p>إذا لم تطلب إعادة تعيين كلمة المرور، يرجى تجاهل هذا البريد الإلكتروني.</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                <div style="text-align: left; direction: ltr;">
                    <p style="font-size: 0.8em; color: #666;">Password Reset Request</p>
                    <p style="font-size: 0.8em; color: #666;">We received a request to reset the password for your Qanon.ai account. Please use the following code:</p>
                    
                    <p style="font-size: 24px; font-weight: bold; color: #0056b3; letter-spacing: 2px; text-align: center;">${resetCode}</p>

                    <p style="font-size: 0.8em; color: #666;">This code is valid for 15 minutes.</p>
                    <p style="font-size: 0.8em; color: #666;">If you did not request a password reset, please ignore this email.</p>
                </div>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Password reset email sent to ${toEmail}`);
    } catch (error) {
        console.error(`Failed to send password reset email to ${toEmail}:`, error.message);
    }
};


module.exports = { sendVerificationEmail, sendResetPasswordEmail };