const fs = require('fs/promises'); 
const path = require('path'); 
const pdf = require('pdf-parse'); 
const mammoth = require('mammoth'); 
const { createWorker } = require('tesseract.js'); 
const { client: weaviateClient } = require('../config/weaviateClient');
const { EmbeddingsClass, textSplitter } = require('../config/aiConfig');

const LEGAL_DATA_DIR = path.join(__dirname, '..', 'legal_data'); 

/**
 * @param {string} filePath 
 * @returns {Promise<string>} 
 */
const extractTextFromFile = async (filePath) => {

    
    const ext = path.extname(filePath).toLowerCase(); 
    const fileBuffer = await fs.readFile(filePath); 

    if (ext === '.pdf') {
        const data = await pdf(fileBuffer);
        return data.text;
    } else if (ext === '.docx') {
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        return result.value;
    } else if (ext === '.txt') {
        return fileBuffer.toString('utf8');
    } else if (['.jpg', '.jpeg', '.png', '.gif', '.tif', '.tiff', '.webp', '.bmp'].includes(ext)) {
        const worker = await createWorker('ara',1); 
        const { data: { text } } = await worker.recognize(fileBuffer);
        await worker.terminate(); 
        return text;
    } 
    else {
        throw new Error(`Unsupported file type: ${ext}`);
    }
};

const loadLegalDataToWeaviate = async () => {
    console.log('Starting to load legal data to Weaviate...');
    try {
        const files = await fs.readdir(LEGAL_DATA_DIR);

        const embeddingsInstance = new EmbeddingsClass({
            modelName: "embedding-001",
            apiKey: process.env.GOOGLE_GEMINI_API_KEY,
        });

        const supportedFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.pdf', '.docx', '.txt'].includes(ext);
        });

        if (supportedFiles.length === 0) {
            console.log('No supported legal data files found in the legal_data directory.');
            return;
        }

        for (const file of supportedFiles) {
            const filePath = path.join(LEGAL_DATA_DIR, file);
            console.log(`Processing file: ${file}`);

            try {
                const rawText = await extractTextFromFile(filePath);

                const docs = await textSplitter.createDocuments([rawText]);

                console.log(`Split ${file} into ${docs.length} chunks.`);

                for (let i = 0; i < docs.length; i++) {
                    const chunk = docs[i].pageContent;
                    const vector = await embeddingsInstance.embedQuery(chunk);

                    const dataObject = {
                        title: `${file} - Part ${i + 1}`, 
                        text: chunk,
                        source: file, 
                        articleNumber: '',
                        chapter: '',
                        category: ['قانوني', path.extname(file).replace('.', '')],
                        datePublished: new Date(),
                        keywords: [],
                    };

                    await weaviateClient.data.creator()
                        .withClassName('LegalArticle') 
                        .withProperties(dataObject)
                        .withVector(vector) 
                        .do();

                    console.log(`Saved chunk ${i + 1} of ${file} to Weaviate.`);
                }
                console.log(`Successfully processed and loaded data from ${file}.`);
            } catch (fileError) {
                console.error(`Error processing file ${file}:`, fileError.message);
            }
        }
        console.log('Finished loading legal data to Weaviate.');
    } catch (error) {
        console.error('Error in loadLegalDataToWeaviate function:', error.message);
    }
};

module.exports = {
    loadLegalDataToWeaviate,
    extractTextFromFile 
};