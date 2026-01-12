// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const path = require('path');

// Import local modules
const { init, insertResume, getAllResumes, getResumeById } = require('./db');
const { getEmbedding, cosine } = require('./embed');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static('public')); // Serves the frontend files

// Multer setup for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 15 * 1024 * 1024 } 
});

// Initialize DB on start
init().catch(err => console.error('DB init error:', err));

// --- API Routes ---

// 1. Upload Resume
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File is required' });
    
    const buffer = req.file.buffer;
    const originalName = req.file.originalname.toLowerCase();
    const mime = req.file.mimetype;
    let text = '';

    // Extract text based on file type
    if (mime === 'application/pdf' || originalName.endsWith('.pdf')) {
      const data = await pdfParse(buffer);
      text = data.text;
    } else if (originalName.endsWith('.docx') || originalName.endsWith('.doc')) {
      const result = await mammoth.extractRawText({ buffer: buffer });
      text = result.value;
    } else if (mime === 'text/plain' || originalName.endsWith('.txt')) {
      text = buffer.toString('utf8');
    } else {
      return res.status(400).json({ error: 'Unsupported file type. Use PDF, DOCX, or TXT.' });
    }

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Could not extract text from file.' });
    }

    // Generate Embedding & Save
    const embedding = await getEmbedding(text);
    const resumeData = {
      name: req.body.name || 'Unknown Candidate',
      email: req.body.email || 'No Email',
      text: text,
      embedding: JSON.stringify(embedding),
      fileName: req.file.originalname
    };

    const saved = await insertResume(resumeData);
    res.json({ success: true, id: saved.insertId, snippet: text.slice(0, 200) });

  } catch (err) {
    console.error('Upload Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Search Resumes
app.post('/api/search', async (req, res) => {
  try {
    const { query, top_k } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });

    const k = top_k || 5;
    const queryVector = await getEmbedding(query);
    const allResumes = await getAllResumes();

    // Calculate Cosine Similarity
    const scoredResumes = allResumes.map(resume => {
      let vec = [];
      try { vec = JSON.parse(resume.embedding || '[]'); } catch (e) { vec = []; }
      
      const score = cosine(queryVector, vec);
      return {
        id: resume.id,
        name: resume.name,
        email: resume.email,
        fileName: resume.file_name,
        score: score,
        snippet: (resume.text || '').slice(0, 300) + '...'
      };
    });

    // Sort by score (descending)
    scoredResumes.sort((a, b) => b.score - a.score);
    
    res.json(scoredResumes.slice(0, k));

  } catch (err) {
    console.error('Search Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});