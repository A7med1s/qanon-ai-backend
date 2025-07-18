// backend/controllers/legalQnAController.js

const asyncHandler = require('express-async-handler');
const { chatModel } = require('../config/aiConfig');
const User = require('../models/User'); // لتحديث عدد التوكنات

// لا توجد دالة cleanTextForDocx هنا

// @desc    الإجابة على سؤال قانوني مصري (اعتماد كلي على Gemini)
// @route   POST /api/legal-qna/ask
// @access  Private
const askLegalQuestion = asyncHandler(async (req, res) => {
    const { question } = req.body; // سؤال المستخدم (outputFormat لم يعد يستخدم لتمييز المخرج)

    if (!question) {
        res.status(400);
        throw new Error('Please provide a legal question.');
    }

    const prompt = `
    أنت خبير قانوني متخصص في القانون المصري ومساعد ذكاء اصطناعي.
    أجب على السؤال القانوني التالي بدقة ووضوح بناءً على معرفتك بالقانون المصري.
    إذا لم تكن الإجابة ضمن معرفتك أو إذا كان السؤال غير قانوني/أخلاقي، اذكر ذلك بوضوح واعتذر عن الإجابة.
    قدم إجابة شاملة ومفصلة قدر الإمكان.

    السؤال: "${question}"

    الإجابة:
    `;

    try {
        const response = await chatModel.invoke(prompt);
        const generatedAnswer = response.content;

        // تحديث عدد التوكنات المستخدمة للمستخدم
        if (req.user) {
            const estimatedTokens = question.length / 4 + generatedAnswer.length / 4;
            req.user.tokensConsumed += Math.ceil(estimatedTokens);
            await req.user.save();
        }

        // **هنا بنرجع النص العادي دايماً**
        res.json({ answer: generatedAnswer });

    } catch (error) {
        console.error('Error asking legal question:', error.message);
        res.status(500).json({ message: 'Failed to process your legal question.', error: error.message });
    }
});

module.exports = {
    askLegalQuestion,
};