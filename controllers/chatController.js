// backend/controllers/chatController.js

const asyncHandler = require('express-async-handler');
const User = require('../models/User'); // استخدام موديل المستخدم لتحديث التوكنات
const Conversation = require('../models/Conversation'); // موديل المحادثة

// استيراد موديلات الذكاء الاصطناعي وجميع متحكمات الأدوات من aiConfig.js
// هذا يضمن استيرادها مرة واحدة فقط وبشكل صحيح
const { chatModel, EmbeddingsClass } = require('../config/aiConfig')
// **استيراد متحكمات الأدوات مباشرة هنا**
const documentAnalysisController = require('./documentAnalysisController');
const contractManagementController = require('./contractManagementController');
const riskAnalysisController = require('./riskAnalysisController');
const caseAnalysisController = require('./caseAnalysisController');

const { extractTextFromFile } = require('../services/legalDataService'); // لاستخراج النص من الملفات
const fs = require('fs/promises'); // لحذف الملفات المؤقتة
const { Document, Packer, Paragraph, TextRun } = require('docx'); // لتوليد ملفات DOCX

// دالة مساعدة لتنظيف المحتوى الذي يأتي من الـ AI من أجل ملفات DOCX
const cleanTextForDocx = (text) => {
    return text ? text.replace(/\0/g, '').replace(/\u00A0/g, ' ') : '';
};

/**
 * دالة لمعالجة رسالة المستخدم، وفهم نيته، واستدعاء الأداة المناسبة.
 * هذا هو المنطق الأساسي للمساعد الشخصي بالذكاء الاصطناعي.
 * @param {object} req - كائن الطلب (يحتوي على req.body, req.file, req.user)
 * @param {object} res - كائن الاستجابة (لاستخدام MockRes)
 * @returns {Promise<{aiResponseContent: string, responseType: string, responseDetails: object}>} - محتوى الرد من الـ AI، نوعه، وتفاصيله.
 */

const processUserMessage = async (req, res) => {
    const { message, outputFormat = 'text', toolSpecificData } = req.body;
    const userMessageContent = message || (req.file ? req.file.originalname : '');

    let aiResponseContent = '';
    let responseType = 'text';
    let responseDetails = {};

    try {

        const intentPrompt = `
        أنت مساعد ذكاء اصطناعي متخصص في القانون المصري. مهمتك تحديد نية المستخدم من رسالته وتحديد الأداة القانونية المناسبة التي يريد استخدامها.
        حدد نية المستخدم من بين الخيارات التالية فقط:
        - summarize (لطلب تلخيص)
        - extract_info (لطلب استخلاص معلومات)
        - rephrase_text (لطلب إعادة صياغة نص)
        - create_contract (لطلب إنشاء عقد)
        - rephrase_contract (لطلب إعادة صياغة عقد)
        - analyze_risks (لطلب تحليل مخاطر)
        - analyze_case (لطلب تحليل قضية)
        - general_chat (للمحادثات العامة أو لو لم يتم فهم نية محددة)

        الرجاء الرد باسم النية (الأداة) فقط، لا تضيف أي نص آخر.

        رسالة المستخدم: "${userMessageContent}"

        النية:
        `;

        const intentResponse = await chatModel.invoke(intentPrompt); 
        const detectedIntent = (intentResponse.content || 'general_chat').trim().toLowerCase();

        const mockReq = {
            body: {
                outputFormat: outputFormat,
                message: message,
            },
            file: req.file,
            user: req.user,
        };
        const mockRes = {
            status: (code) => { console.log(`DEBUG: MockRes Status: ${code}`); return mockRes; },
            json: (data) => {
                aiResponseContent = data.summary || data.extractedInfo || data.rephrasedText ||
                                    data.contractDraft || data.rephrasedContract ||
                                    data.analysis || data.message || 'لا توجد نتيجة.';
                responseType = 'text';
            },
            send: (buffer) => {
                responseType = 'docx_buffer';
                responseDetails.buffer = buffer;
                responseDetails.fileName = `<span class="math-inline">\{detectedIntent\}\_</span>{Date.now()}.docx`;
            },
        };

        switch (detectedIntent) {
            case 'summarize':
                mockReq.body.text = userMessageContent;
                await documentAnalysisController.summarizeText(mockReq, mockRes);
                break;
            case 'extract_info':
                mockReq.body.text = userMessageContent;
                mockReq.body.query = toolSpecificData?.query || "استخلص جميع الكيانات والتواريخ الهامة.";
                await documentAnalysisController.extractInformation(mockReq, mockRes);
                break;
            case 'rephrase_text':
                mockReq.body.text = userMessageContent;
                mockReq.body.style = toolSpecificData?.style || "بأسلوب قانوني رسمي.";
                await documentAnalysisController.rephraseText(mockReq, mockRes);
                break;
            case 'create_contract':
                aiResponseContent = "لإنشاء عقد، أحتاج نوع العقد، الأطراف، والشروط الأساسية. يرجى تزويدي بها بتنسيق واضح.";
                responseType = 'text';
                break;
            case 'rephrase_contract':
                if (req.file) { /* handled by mockReq.file */ } else { mockReq.body.contractText = userMessageContent; }
                mockReq.body.desiredStyle = toolSpecificData?.style || "بأسلوب قانوني رسمي.";
                await contractManagementController.rephraseContract(mockReq, mockRes);
                break;
            case 'analyze_risks':
                if (req.file) { /* handled by mockReq.file */ } else { mockReq.body.contractText = userMessageContent; }
                await riskAnalysisController.analyzeRisks(mockReq, mockRes);
                break;
            case 'analyze_case':
                if (req.file) { /* handled by mockReq.file */ } else { mockReq.body.caseText = userMessageContent; }
                await caseAnalysisController.analyzeCase(mockReq, mockRes);
                break;
            case 'general_chat':
            default:
                const generalPrompt = `
                أنت مساعد قانوني شخصي. أجب على السؤال التالي أو نفذ المهمة.
                السؤال/المهمة: "${userMessageContent}"
                `;
                const generalResponse = await chatModel.invoke(generalPrompt);
                aiResponseContent = generalResponse.content;
                responseType = 'text';
                break;
        }
        console.log(`DEBUG (Chat Process): Tool execution completed.`); // جديد

        // **المرحلة 3: تحديث استهلاك التوكنات للمستخدم**
        const estimatedTokens = userMessageContent.length / 4 + (aiResponseContent ? aiResponseContent.length / 4 : 0);
        if (req.user) {
            req.user.tokensConsumed += Math.ceil(estimatedTokens);
            await req.user.save();
            console.log(`DEBUG (Chat): User ${req.user.email} tokens consumed updated.`);
        }

    } catch (error) {
        console.error('ERROR (Chat Process): Failed to process message or execute tool:', error.message); // جديد
        // لو الأداة نفسها ضربت خطأ، بنرجع رسالة عامة للمستخدم
        aiResponseContent = "عذراً، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى."; // رسالة عامة للخطأ
        responseType = 'text';
        responseDetails = {};
    }

    return { aiResponseContent, responseType, responseDetails };
};
// @desc    إرسال رسالة إلى المساعد الشخصي والحصول على رد
// @route   POST /api/chat/send-message
// @access  Private
const sendMessage = asyncHandler(async (req, res) => {
    const { message, conversationId } = req.body; // message: رسالة المستخدم، conversationId: لو محادثة قديمة
    const userId = req.user._id; // ID المستخدم من التوكن

    let currentConversation;

    // لو فيه conversationId، بنجيب المحادثة القديمة
    if (conversationId) {
        currentConversation = await Conversation.findById(conversationId);
        if (!currentConversation || currentConversation.user.toString() !== userId.toString()) {
            res.status(404);
            throw new Error('Conversation not found or not authorized.');
        }
    } else {
        // لو مفيش conversationId، بنعمل محادثة جديدة
        currentConversation = new Conversation({
            user: userId,
            title: 'محادثة جديدة ' + new Date().toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })
        });
    }

    // إضافة رسالة المستخدم للمحادثة
    let userMessageObj = {
        sender: 'user',
        content: message || (req.file ? req.file.originalname : 'رسالة فارغة'),
        type: req.file ? 'file' : 'text',
        fileDetails: req.file ? {
            fileName: req.file.originalname,
            fileUrl: '', // Placeholder, will be populated if files are stored externally
            fileType: req.file.mimetype,
        } : undefined
    };
    currentConversation.messages.push(userMessageObj);

    // معالجة رسالة المستخدم والحصول على رد AI
    const { aiResponseContent, responseType, responseDetails } = await processUserMessage(req, res);

    // إضافة رد الـ AI للمحادثة
    let aiMessageObj = {
        sender: 'ai',
        content: aiResponseContent,
        type: responseType === 'docx_buffer' ? 'tool_result' : responseType, // إذا كان DOCX، يتم وضع علامة كـ tool_result
        toolResultDetails: responseType === 'docx_buffer' ? {
            toolName: responseDetails.fileName.split('_')[0], // استخراج اسم الأداة من اسم الملف
            resultFormat: 'docx',
            // يمكنك تخزين ملف DOCX في Cloudflare R2 وحفظ الرابط هنا
            // حاليا، هو مجرد placeholder يشير إلى أنه تم توليد DOCX
        } : undefined,
        fileDetails: responseType === 'docx_buffer' ? {
            fileName: responseDetails.fileName,
            fileUrl: '', // سيكون هذا هو رابط التنزيل الفعلي إذا تم تخزينه
            fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        } : undefined,
    };
    currentConversation.messages.push(aiMessageObj);

    await currentConversation.save(); // حفظ المحادثة

    // إرجاع الرد النهائي (إما ملف أو JSON)
    if (responseType === 'docx_buffer' && responseDetails.buffer) {
        res.setHeader('Content-Disposition', `attachment; filename=${responseDetails.fileName}`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.send(responseDetails.buffer);
    } else {
        res.status(200).json({
            message: aiResponseContent,
            conversation: currentConversation, // إرجاع المحادثة كاملة (لتحديثها في الواجهة الأمامية)
            isNewConversation: !conversationId,
        });
    }
});

// @desc    الحصول على قائمة المحادثات الخاصة بالمستخدم
// @route   GET /api/chat/conversations
// @access  Private
const getConversations = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    // جلب المحادثات مع حقول محددة وترتيبها حسب آخر تحديث
    const conversations = await Conversation.find({ user: userId }).select('title createdAt updatedAt').sort({ updatedAt: -1 });
    res.status(200).json(conversations);
});

// @desc    الحصول على محتوى محادثة معينة
// @route   GET /api/chat/conversations/:id
// @access  Private
const getConversationById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findById(id);

    if (!conversation || conversation.user.toString() !== userId.toString()) {
        res.status(404);
        throw new Error('Conversation not found or not authorized.');
    }

    res.status(200).json(conversation);
});

module.exports = {
    sendMessage,
    getConversations,
    getConversationById,
};