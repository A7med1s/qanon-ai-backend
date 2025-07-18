const asyncHandler = require('express-async-handler');
const { chatModel } = require('../config/aiConfig');
const { extractTextFromFile } = require('../services/legalDataService');
const { Document, Packer, Paragraph, HeadingLevel, AlignmentType } = require('docx');
const fs = require('fs/promises');

const cleanTextForDocx = (text) => {
    return text ? text.replace(/\0/g, '').replace(/\u00A0/g, ' ') : '';
};

const createArabicDocx = async (title, content) => {
    const children = [];

    children.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }));

    const paragraphs = content.split('\n').filter(p => p.trim() !== '');
    paragraphs.forEach(p => {
        if (p.startsWith('**') && p.endsWith('**')) { 
            children.push(new Paragraph({ text: p.substring(2, p.length - 2), heading: HeadingLevel.HEADING_2 }));
        } else if (p.startsWith('* ') || p.startsWith('- ')) { 
            children.push(new Paragraph({ text: p.substring(2), bullet: { level: 0 } }));
        } else {
            children.push(new Paragraph({ text: p }));
        }
    });

    const doc = new Document({
        creator: "Qanon.ai",
        title: title,
        styles: {
            default: {
                document: {
                    run: { font: "Traditional Arabic", size: "12pt", rightToLeft: true },
                    paragraph: { alignment: AlignmentType.RIGHT, spacing: { after: 120 } },
                },
                heading1: {
                    run: { font: "Traditional Arabic", size: "18pt", bold: true, color: "0056b3" },
                    paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 240 } },
                },
                heading2: {
                    run: { font: "Traditional Arabic", size: "14pt", bold: true },
                    paragraph: { spacing: { before: 200, after: 140 } },
                },
            },
        },
        sections: [{
            properties: { rightToLeft: true }, // تفعيل الاتجاه من اليمين لليسار للقسم كله
            children: children,
        }],
    });

    return Packer.toBuffer(doc);
};


const processRequest = async (req, res, promptTemplate, docxTitle, responseJsonKey) => {
    // تم دمج المتغيرات من كلا الكودين
    const { text, query, style, outputFormat, caseFacts, representedParty } = req.body;
    let contentToProcess = text || caseFacts; // المحتوى الرئيسي يأتي من text أو caseFacts

    // معالجة الملف المرفوع
    if (req.file) {
        try {
            contentToProcess = await extractTextFromFile(req.file.path);
                        await fs.unlink(req.file.path);
        } catch (error) {
            res.status(400);
            throw new Error('Failed to extract text from uploaded file: ' + error.message);
        }
    }

    // التحقق من وجود المحتوى المطلوب
    if (!contentToProcess) {
        res.status(400);
        throw new Error('Missing required text, caseFacts, or file.');
    }

    // بناء الـ Prompt بشكل ديناميكي
    const prompt = promptTemplate
        .replace('{contentToProcess}', contentToProcess)
        .replace('{query}', query || '')
        .replace('{style}', style ? `بأسلوب ${style} قانوني ومناسب.` : 'بأسلوب قانوني رسمي ومناسب.')
        .replace('{representedParty}', representedParty || ''); // إضافة المتغير الجديد

    try {
        const response = await chatModel.invoke(prompt);
        const generatedContent = response.content;

        // حساب التوكنز المستهلكة
        if (req.user) {
            const estimatedTokens = (prompt.length + generatedContent.length) / 4;
            req.user.tokensConsumed += Math.ceil(estimatedTokens);
            await req.user.save();
        }

        // إرجاع الاستجابة بالتنسيق المطلوب
        if (outputFormat === 'docx') {
            const cleanedContent = cleanTextForDocx(generatedContent);
            const buffer = await createArabicDocx(docxTitle, cleanedContent);
            res.setHeader('Content-Disposition', `attachment; filename=${responseJsonKey}_${Date.now()}.docx`);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.send(buffer);
        } else {
            res.json({ [responseJsonKey]: generatedContent });
        }
    } catch (error) {
        res.status(500).json({ message: `Failed to process request: ${docxTitle}.`, error: error.message });
    }
};


const generatePersuasionPoints = asyncHandler(async (req, res) => {
    // 1. التحقق من المدخلات الخاصة بهذه الوظيفة تحديداً
    const { representedParty } = req.body;
    const content = req.body.caseFacts || req.file;
    if (!content || !representedParty) {
        res.status(400);
        throw new Error('Please provide case facts (or a file) and the represented party.');
    }

    // 2. تحديد الـ Prompt الخاص بالوظيفة مع استخدام المتغيرات القياسية
    const promptTemplate = `
        أنت محامٍ خبير ومساعد قانوني متخصص في القانون المصري، ولديك مهارة عالية في صياغة الحجج المقنعة. مهمتك هي تحليل وقائع القضية التالية وتقديم "نقاط إقناع" قوية وحجج قانونية مركزة لدعم موقف "{representedParty}".

        ركز على الجوانب الأكثر تأثيراً في القضية التي يمكن أن تدعم موقف {representedParty}، واستخرج الحقائق الأساسية التي يمكن تحويلها إلى أدلة قوية.

        وقائع القضية:
        "{contentToProcess}"

        الطرف الذي أمثله: "{representedParty}"

        نقاط الإقناع والحجج القانونية المقترحة لموقف {representedParty} (على هيئة نقاط واضحة ومختصرة باستخدام علامة * في بداية كل نقطة):
    `;

    // 3. استدعاء الدالة المركزية مع تمرير المعطيات المناسبة
    await processRequest(req, res, promptTemplate, `نقاط إقناع لموقف ${representedParty}`, "persuasionPoints");
});


module.exports = {
    generatePersuasionPoints, // إضافة الوظيفة الجديدة
};