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
        if (p.trim().startsWith('البند')) {
            children.push(new Paragraph({ text: p, heading: HeadingLevel.HEADING_2 }));
        } else if (p.startsWith('**') && p.endsWith('**')) {
            children.push(new Paragraph({ text: p.substring(2, p.length - 2), heading: HeadingLevel.HEADING_2 }));
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
                    paragraph: { alignment: AlignmentType.RIGHT, rightToLeft: true, spacing: { after: 120, line: 360 } },
                },
                heading1: {
                    run: { font: "Traditional Arabic", size: "18pt", bold: true, color: "0056b3" },
                    paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 240 } },
                },
                heading2: { 
                    run: { font: "Traditional Arabic", size: "14pt", bold: true },
                    paragraph: { alignment: AlignmentType.RIGHT, spacing: { before: 200, after: 140 } },
                },
            },
        },
        sections: [{ 
            properties: {},
            children: children,
        }],
    });

    return Packer.toBuffer(doc);
};



const createContract = asyncHandler(async (req, res) => {
    const { contractType, otherDetails, outputFormat } = req.body;
    const parties = req.body.parties ? req.body.parties.split(',').map(p => p.trim()).filter(p => p) : [];
    const terms = req.body.terms ? req.body.terms.split(',').map(t => t.trim()).filter(t => t) : [];

    if (!contractType || parties.length === 0 || terms.length === 0) {
        res.status(400);
        throw new Error('Please provide contract type, parties, and key terms.');
    }

    const prompt = `
    أنت خبير صياغة عقود متخصص في القانون المصري.
    مهمتك هي صياغة مسودة عقد قانوني من نوع "${contractType}" بين الأطراف التالية:
    ${parties.map(p => `- ${p}`).join('\n')}

    يجب أن يتضمن العقد البنود الأساسية التالية:
    ${terms.map(t => `- ${t}`).join('\n')}
    
    تفاصيل إضافية يجب مراعاتها: ${otherDetails || 'لا يوجد'}

    **تعليمات صارمة للصياغة:**
    1.  ابدأ العنوان الرئيسي بـ "**عقد ${contractType}**".
    2.  قم بتنظيم العقد بشكل كامل على هيئة بنود مرقمة حرفياً (مثال: "البند الأول:", "البند الثاني:", "البند الثالث:").
    3.  **لا تستخدم أبداً** القوائم النقطية (التي تبدأ بـ * أو -) في جسم العقد، استخدم فقط تنسيق البنود المذكور.
    4.  تأكد من أن الصياغة قانونية، واضحة، وشاملة وفقًا للقانون المصري.

    مسودة العقد:
    `;

    try {
        const response = await chatModel.invoke(prompt);
        const contractDraft = response.content;

        if (req.user) {
            const estimatedTokens = (prompt.length + contractDraft.length) / 4;
            req.user.tokensConsumed += Math.ceil(estimatedTokens);
            await req.user.save();
        }

        if (outputFormat === 'docx') {
            const buffer = await createArabicDocx(`عقد ${contractType}`, cleanTextForDocx(contractDraft));

            const encodedContractType = encodeURIComponent(contractType.replace(/\s/g, '_'));
            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''contract_${encodedContractType}_${Date.now()}.docx`);
            
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.send(buffer);
        } else {
            res.json({ contractDraft });
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to create contract draft.', error: error.message });
    }
});

const rephraseContract = asyncHandler(async (req, res) => {
    let { contractText, desiredStyle, outputFormat } = req.body;

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
        throw new Error('Please provide contract text in the body or upload a file.');
    }

    const styleInstruction = desiredStyle ? `بأسلوب ${desiredStyle}` : 'بأسلوب قانوني رسمي ومحسن';

    const prompt = `
    أنت خبير صياغة عقود متخصص في القانون المصري.
    مهمتك هي إعادة صياغة العقد القانوني التالي ${styleInstruction} مع الحفاظ على جميع الأحكام والمعنى القانوني الدقيق.

    **تعليمات صارمة لإعادة الصياغة:**
    1.  قم بتنظيم العقد الجديد بشكل كامل على هيئة بنود مرقمة حرفياً (مثال: "البند الأول:", "البند الثاني:").
    2.  **لا تستخدم أبداً** القوائم النقطية (التي تبدأ بـ * أو -)، وحول أي قوائم موجودة إلى بنود فرعية إذا لزم الأمر.
    3.  إذا كان هناك أي غموض أو تناقضات في النص الأصلي، حاول توضيحها في الصياغة الجديدة.
    
    العقد الأصلي:
    "${contractText}"

    العقد المعاد صياغته:
    `;

    try {
        const response = await chatModel.invoke(prompt);
        const rephrasedContract = response.content;

        if (req.user) {
            const estimatedTokens = (prompt.length + rephrasedContract.length) / 4;
            req.user.tokensConsumed += Math.ceil(estimatedTokens);
            await req.user.save();
        }

        if (outputFormat === 'docx') {
            const buffer = await createArabicDocx("العقد المعاد صياغته", cleanTextForDocx(rephrasedContract));
            res.setHeader('Content-Disposition', `attachment; filename=rephrased_contract_${Date.now()}.docx`);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.send(buffer);
        } else {
            res.json({ rephrasedContract });
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to rephrase contract.', error: error.message });
    }
});


module.exports = {
    createContract,
    rephraseContract,
};