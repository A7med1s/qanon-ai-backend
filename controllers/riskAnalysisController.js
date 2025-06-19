const asyncHandler = require('express-async-handler');
const { chatModel } = require('../config/aiConfig');
const { extractTextFromFile } = require('../services/legalDataService');
const { Document, Packer, Paragraph, TextRun, AlignmentType } = require('docx');
const fs = require('fs/promises');

const cleanTextForDocx = (text) => {
    return text ? text.replace(/\0/g, '').replace(/\u00A0/g, ' ') : '';
};

const analyzeRisks = asyncHandler(async (req, res) => {
    let { contractText, outputFormat } = req.body;

    if (req.file) {
        try {
            contractText = await extractTextFromFile(req.file.path);
            await fs.unlink(req.file.path);
        } catch (error) {
            res.status(400);
            throw new Error('Failed to extract text from uploaded file: ' + error.message);
        }
    }

    if (!contractText) {
        res.status(400);
        throw new Error('Please provide contract text or upload a file for risk analysis.');
    }

    const prompt = `
    أنت خبير قانوني متخصص في القانون المصري، ومهمتك هي تحليل العقود لتحديد المخاطر.
    الرجاء تحليل النص القانوني التالي بدقة.

    **مهمتك:**
    1.  **تحديد نقاط الضعف:** ابحث عن أي بنود غامضة، أو غير عادلة، أو قد تسبب مشاكل في المستقبل.
    2.  **تحديد المخاطر القانونية:** أشر إلى أي تعارضات محتملة مع القانون المصري أو أي مسؤوليات قانونية غير واضحة.
    3.  **تقديم اقتراحات للتحسين:** اقترح صياغات بديلة أو بنود إضافية لحماية مصالح المستخدم.

    **تعليمات صارمة للتنسيق:**
    -   استخدم عناوين واضحة لكل قسم، مثل: "**نقاط الضعف:**"، "**المخاطر القانونية:**"، "**اقتراحات للتحسين:**".
    -   تحت كل عنوان، ابدأ كل نقطة تحليلية بسطر جديد. **لا تستخدم** علامات القوائم النقطية مثل * أو -.

    النص الأصلي:
    "${contractText}"

    التحليل والاقتراحات:
    `;

    try {
        const response = await chatModel.invoke(prompt);
        const analysisResult = response.content;

        if (req.user) {
            const estimatedTokens = (prompt.length + analysisResult.length) / 4;
            req.user.tokensConsumed += Math.ceil(estimatedTokens);
            await req.user.save();
        }

        if (outputFormat === 'docx') {

            const cleanedContent = cleanTextForDocx(analysisResult);
            const contentLines = cleanedContent.split('\n');
            const children = [];

            children.push(new Paragraph({
                children: [new TextRun({
                    text: "تحليل المخاطر ونقاط الضعف",
                    bold: true,
                    size: 36, // 18pt
                    font: "Traditional Arabic",
                    rightToLeft: true,
                })],
                alignment: AlignmentType.CENTER,
                rightToLeft: true,
            }));
            
            children.push(new Paragraph("")); 

            contentLines.forEach(line => {
                const trimmedLine = line.trim();
                if (trimmedLine === '') return;

                let text = trimmedLine;
                let isHeading = false;

                if (text.startsWith('**') && text.endsWith('**')) {
                    text = text.substring(2, text.length - 2);
                    isHeading = true;
                }
                else if (text.startsWith('* ') || text.startsWith('- ')) {
                    text = text.substring(2);
                }

                children.push(new Paragraph({
                    children: [
                        new TextRun({
                            text: text,
                            bold: isHeading,
                            size: isHeading ? 28 : 24, 
                            font: "Traditional Arabic",
                            rightToLeft: true,
                        })
                    ],
                    alignment: AlignmentType.RIGHT, 
                    rightToLeft: true,
                    spacing: { before: isHeading ? 200 : 0, after: 100 },
                }));
            });

            const doc = new Document({
                sections: [{
                    properties: {},
                    children: children,
                }],
            });

            const buffer = await Packer.toBuffer(doc);
            res.setHeader('Content-Disposition', `attachment; filename=risk_analysis_${Date.now()}.docx`);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.send(buffer);

        } else {
            res.json({ analysis: analysisResult });
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to analyze risks.', error: error.message });
    }
});

module.exports = {
    analyzeRisks,
};