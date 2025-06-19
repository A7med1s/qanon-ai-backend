const mongoose = require('mongoose');

const messageSchema = mongoose.Schema(
    {
        sender: {
            type: String, 
            required: true,
        },
        content: {
            type: String, 
            required: true,
        },
        type: {
            type: String, 
            enum: ['text', 'file', 'tool_result'],
            default: 'text',
        },
        timestamp: {
            type: Date,
            default: Date.now,
        },
        fileDetails: { 
            fileName: String,
            fileUrl: String, 
            fileType: String,
        },
        toolResultDetails: { 
            toolName: String, 
            resultFormat: String,
            originalPrompt: String, 
        },
    }
);

const conversationSchema = mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId, 
            required: true,
            ref: 'User', 
        },
        title: {
            type: String,
            default: 'محادثة جديدة', 
        },
        messages: [messageSchema], 
    },
    {
        timestamps: true, 
    }
);

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;