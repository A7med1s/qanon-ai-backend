const asyncHandler = require('express-async-handler');
const { chatModel } = require('../config/aiConfig');
const { extractTextFromFile } = require('../services/legalDataService');
const { Document, Packer, Paragraph, TextRun, AlignmentType } = require('docx');
const fs = require('fs/promises');

const cleanTextForDocx = (text) => {
    return text ? text.replace(/\0/g, '').replace(/\u00A0/g, ' ') : '';
};

const analyzeCase = asyncHandler(async (req, res) => {
    let { caseText, outputFormat } = req.body;

    if (req.file) {
        try {
            caseText = await extractTextFromFile(req.file.path);
            await fs.unlink(req.file.path);
        } catch (error) {
            res.status(400);
            throw new Error('Failed to extract text from uploaded file: ' + error.message);
        }
    }

    if (!caseText) {
        res.status(400);
        throw new Error('Please provide case text in the body or upload a file for analysis.');
    }

    const prompt = `
    [SYSTEM]
أنت مساعد قانوني خبير في القانون المصري، متخصص في التحليل العميق لملفات القضايا. قم بتحليل النص التالي بدقة متناهية. يجب أن يكون تحليلك موجهاً لخدمة مصالح "موكلي" المحدد في نص القضية.
[CONTEXT]
ملف القضية:
"${caseText}"
[TASK]
بناءً على ملف القضية أعلاه، قم بإعداد تحليل قانوني شامل ومفصل. يجب أن يتبع التحليل الهيكل المحدد والتعليمات التالية بدقة:

**الهيكل المطلوب:**
    1.  **ملخص شامل للقضية:** (الأطراف، موضوع النزاع، الوقائع الأساسية).
    2.  **نقاط القوة والضعف:** في موقف موكلك (الطرف الذي ندافعه).
    3.  **اقتراحات أولية للعمل عليها:** (خطوات إجرائية، طلبات محددة، وثائق مطلوبة).
    4.  **اقتراحات متقدمة ومبتكرة لحل القضية:** (استراتيجيات قانونية غير تقليدية، سوابق قضائية ذات صلة، طرق تفاوض أو تسوية).
    5.  **اذكر أرقام المواد ونصوص القوانين المصرية التي تدعم موقف الموكل بشكل مباشر

   **تعليمات التنسيق (إلزامية):**
- استخدم العناوين الخمسة المذكورة أعلاه بنص عريض (Bold).

    `;

    try {
        const response = await chatModel.invoke(prompt);
        const analysisResult = response.content;

        if (req.user) {
            const estimatedTokens = prompt.length / 4 + analysisResult.length / 4;
            req.user.tokensConsumed += Math.ceil(estimatedTokens);
            await req.user.save();
        }

        if (outputFormat === 'docx') {

            const cleanedContent = cleanTextForDocx(analysisResult);
            const contentLines = cleanedContent.split('\n');
            const children = []; 

            children.push(new Paragraph({
                children: [new TextRun({
                    text: "تحليل القضية واقتراحات الحل",
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
            res.setHeader('Content-Disposition', `attachment; filename=case_analysis_${Date.now()}.docx`);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.send(buffer);

        } else {
            res.json({ analysis: analysisResult });
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to analyze case.', error: error.message });
    }
});

module.exports = {
    analyzeCase,
};

