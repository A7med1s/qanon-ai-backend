const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const { createWeaviateSchema } = require('./config/weaviateClient');

const userRoutes = require('./routes/userRoutes');
const documentAnalysisRoutes = require('./routes/documentAnalysisRoutes');
const contractManagementRoutes = require('./routes/contractManagementRoutes');
const riskAnalysisRoutes = require('./routes/riskAnalysisRoutes');
const caseAnalysisRoutes = require('./routes/caseAnalysisRoutes');
const legalQnARoutes = require('./routes/legalQnARoutes'); // استيراد مسارات أداة الأسئلة القانونية
const legalStorytellingRoutes = require('./routes/legalStorytellingRoutes'); 


dotenv.config();

connectDB();
// createWeaviateSchema(); 

const app = express();


app.use(cors());

app.use((req, res, next) => {
    // console.log(`DEBUG (Server): Incoming request: ${req.method} ${req.originalUrl}`);
    next();
});

app.get('/', (req, res) => {
    res.send('Qanon.ai Backend is running!');
});


app.use('/api/tools/document-analysis', documentAnalysisRoutes);
app.use('/api/contract-management', contractManagementRoutes);
app.use('/api/risk-analysis', riskAnalysisRoutes);
app.use('/api/case-analysis', caseAnalysisRoutes);  
app.use('/api/legal-qna', legalQnARoutes);
app.use('/api/legal-storytelling', legalStorytellingRoutes); // **ربط مسارات الأداة الجديدة**

app.use('/api/users', express.json(), express.urlencoded({ extended: false }), userRoutes);


app.use((req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
});

app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Qanon.ai Backend started successfully!');
});