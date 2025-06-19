const asyncHandler = require('express-async-handler');
const { chatModel } = require('../config/aiConfig');
const fs = require('fs/promises');
const { extractTextFromFile } = require('../services/legalDataService');
const { Document, Packer, Paragraph, HeadingLevel, AlignmentType } = require('docx');


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
                    paragraph: { alignment: AlignmentType.RIGHT, rightToLeft: true, spacing: { after: 120 } },
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
            children: children,
        }],
    });

    return Packer.toBuffer(doc);
};




const processRequest = async (req, res, promptTemplate, docxTitle, responseJsonKey) => {
    const { text, query, style, outputFormat } = req.body;
    let contentToProcess = text;

    if (req.file) {
        try {
            contentToProcess = await extractTextFromFile(req.file.path);
            await fs.unlink(req.file.path);
        } catch (error) {
            res.status(400);
            throw new Error('Failed to extract text from uploaded file: ' + error.message);
        }
    }

    if (!contentToProcess || (promptTemplate.includes('{query}') && !query)) {
        res.status(400);
        throw new Error('Missing required text, file, or query.');
    }

    const prompt = promptTemplate
        .replace('{contentToProcess}', contentToProcess)
        .replace('{query}', query || '')
        .replace('{style}', style ? `بأسلوب ${style} قانوني ومناسب.` : 'بأسلوب قانوني رسمي ومناسب.');

    try {
        const response = await chatModel.invoke(prompt);
        const generatedContent = response.content;

        if (req.user) {
            const estimatedTokens = (contentToProcess.length + generatedContent.length) / 4;
            req.user.tokensConsumed += Math.ceil(estimatedTokens);
            await req.user.save();
        }

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

const summarizeText = asyncHandler(async (req, res) => {
    const promptTemplate = `
        أنت مساعد قانوني متخصص في القانون المصري.
        الرجاء تلخيص النص القانوني التالي إلى نقاط رئيسية وموجزة، مع الحفاظ على الدقة والمصطلحات القانونية قدر الإمكان.
        اجعل التلخيص سهل القراءة ويركز على النقاط الأساسية.

        النص:
        "{contentToProcess}"

        التلخيص (نقاط رئيسية):
    `;
    await processRequest(req, res, promptTemplate, "ملخص قانوني", "summary");
});

const extractInformation = asyncHandler(async (req, res) => {
    const promptTemplate = `
        أنت مساعد قانوني متخصص في القانون المصري.
        من النص القانوني التالي، الرجاء استخلاص المعلومات المحددة بناءً على السؤال/الاستعلام.
        قدم المعلومات المستخلصة في شكل نقاط أو قائمة واضحة.
        إذا لم تكن المعلومات موجودة بشكل صريح في النص، اذكر ذلك بوضوح.

        النص:
        "{contentToProcess}"

        السؤال/الاستعلام: "{query}"

        المعلومات المستخلصة:
    `;
    await processRequest(req, res, promptTemplate, "استخلاص معلومات قانونية", "extractedInfo");
});

const rephraseText = asyncHandler(async (req, res) => {
    const promptTemplate = `
        أنت مساعد قانوني متخصص في القانون المصري.
        الرجاء إعادة صياغة النص التالي {style} مع الحفاظ على المعنى القانوني الأصلي والدقة.
        إذا كان الأسلوب المطلوب يتعارض مع الدقة القانونية، أشر إلى ذلك.

        النص:
        "{contentToProcess}"

        النص المعاد صياغته:
    `;
    await processRequest(req, res, promptTemplate, "إعادة صياغة قانونية", "rephrasedText");
});

module.exports = {
    summarizeText,
    extractInformation,
    rephraseText,
};