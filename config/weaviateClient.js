const weaviate = require('weaviate-ts-client').default;
require('dotenv').config();

const clientInstance = weaviate.client({ 
    scheme: 'https',
    host: process.env.WEAVIATE_URL.replace('https://', ''),
    apiKey: new weaviate.ApiKey(process.env.WEAVIATE_API_KEY),
});
const createWeaviateSchema = async () => {
    const className = 'LegalArticle';

    const schema = await clientInstance.schema.getter().do(); 
    const existingClass = schema.classes.find(c => c.class === className);

    if (!existingClass) {
        console.log(`Creating Weaviate schema for class: ${className}`);

        const classObj = {
            class: className,
            vectorizer: 'none',
            properties: [
                { name: 'title', dataType: ['text'] },
                { name: 'text', dataType: ['text'] },
                { name: 'source', dataType: ['text'] },
                { name: 'articleNumber', dataType: ['text'] },
                { name: 'chapter', dataType: ['text'] },
                { name: 'category', dataType: ['text[]'], tokenization: 'word' },
                { name: 'datePublished', dataType: ['date'] },
                { name: 'keywords', dataType: ['text[]'] },
            ],
        };

        try {
            await clientInstance.schema.classCreator().withClass(classObj).do(); 
            console.log(`Weaviate schema for ${className} created successfully.`);
        } catch (error) {
            console.error(`Error creating Weaviate schema for ${className}:`, error.message);
        }
    } else {
        console.log(`Weaviate schema for class: ${className} already exists.`);
    }
};

module.exports = { client: clientInstance, createWeaviateSchema };