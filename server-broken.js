// services.js

// Polyfill for window.storage (uses localStorage if specific storage API is missing)
export const setupStorage = () => {
  if (!window.storage) {
    window.storage = {
      list: async (prefix) => {
        const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix));
        return { keys };
      },
      get: async (key) => {
        const val = localStorage.getItem(key);
        return val ? { value: val } : null;
      },
      set: async (key, val) => localStorage.setItem(key, val),
      delete: async (key) => localStorage.removeItem(key)
    };
  }
};

// --- File Extraction Logic ---

export const extractTextFromPDF = async (file, setProgress) => {
  setProgress('Reading PDF file...');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64Data = e.target.result.split(',')[1];
        setProgress('Extracting text from PDF...');
        const response = await callClaudeAPI([
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64Data }
          },
          { type: "text", text: "Extract all text content from this resume PDF. Return only the text content, no analysis or commentary." }
        ]);
        resolve(response);
      } catch (error) { reject(error); }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const extractTextFromWord = async (file, setProgress) => {
  setProgress('Reading Word document...');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result;
        setProgress('Extracting text from Word document...');
        if (!window.mammoth) throw new Error("Mammoth library not loaded");
        const result = await window.mammoth.extractRawText({ arrayBuffer });
        resolve(result.value);
      } catch (error) { reject(error); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

export const extractTextFromImage = async (file, setProgress) => {
  setProgress('Reading image file...');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64Data = e.target.result.split(',')[1];
        setProgress('Extracting text from image (OCR)...');
        const response = await callClaudeAPI([
          {
            type: "image",
            source: { type: "base64", media_type: file.type, data: base64Data }
          },
          { type: "text", text: "Extract all text content from this resume image. Return only the text content, no analysis or commentary." }
        ]);
        resolve(response);
      } catch (error) { reject(error); }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// --- API Helpers ---

const callClaudeAPI = async (content, max_tokens = 2000) => {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens,
      messages: [{ role: "user", content: Array.isArray(content) ? content : [{ type: "text", text: content }] }],
    })
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.content[0].text;
};

export const parseResume = async (text, setProgress) => {
  setProgress('Analyzing resume content...');
  try {
    const prompt = `Parse this resume and extract the following information in JSON format only (no other text):
    {
      "name": "full name",
      "email": "email address",
      "phone": "phone number",
      "education": ["degree 1", "degree 2"],
      "experience": ["job 1 with company and duration", "job 2"],
      "skills": ["skill1", "skill2"],
      "summary": "brief professional summary"
    }
    Resume text: ${text}`;
    
    const content = await callClaudeAPI(prompt, 1000);
    const cleanContent = content.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanContent);
  } catch (error) {
    console.error('Error parsing resume:', error);
    return null;
  }
};

export const generateEmbedding = async (text, setProgress) => {
  setProgress('Generating semantic embedding...');
  try {
    const prompt = `Create a semantic summary of this resume for vector search. Focus on key skills, experience level, education, and expertise areas. Return only the summary text, no other commentary: ${text}`;
    return await callClaudeAPI(prompt, 1000);
  } catch (error) {
    console.error('Error generating embedding:', error);
    return text;
  }
};

export const searchResumesAPI = async (searchQuery, resumes) => {
  const prompt = `You are a resume matching system. Given the search query and a list of resumes, rank them by relevance and provide a match score (0-100).
    Search Query: ${searchQuery}
    Resumes:
    ${resumes.map((r, idx) => `Resume ${idx + 1} (ID: ${r.id}): Name: ${r.name}, Skills: ${r.skills?.join(', ')}, Summary: ${r.summary}, Embedding: ${r.embedding}`).join('\n---\n')}
    
    Return ONLY a JSON array with this exact format (no other text):
    [{"id": "resume_id", "score": 95, "reason": "why this matches"}]
    Order by score (highest first). Only include resumes with score > 30.`;

  const content = await callClaudeAPI(prompt, 2000);
  const cleanContent = content.replace(/```json|```/g, '').trim();
  return JSON.parse(cleanContent);
};

export const generateSQLSchema = (resumes) => {
  return `-- Resume Database Schema for MySQL
-- Generated on ${new Date().toISOString()}

CREATE DATABASE IF NOT EXISTS resume_db;
USE resume_db;

CREATE TABLE resumes (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    summary TEXT,
    raw_text LONGTEXT,
    embedding TEXT,
    file_name VARCHAR(255),
    file_type VARCHAR(100),
    upload_date DATETIME
);

CREATE TABLE education (
    id INT AUTO_INCREMENT PRIMARY KEY,
    resume_id VARCHAR(50),
    degree VARCHAR(500),
    FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE
);

CREATE TABLE experience (
    id INT AUTO_INCREMENT PRIMARY KEY,
    resume_id VARCHAR(50),
    experience TEXT,
    FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE
);

CREATE TABLE skills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    resume_id VARCHAR(50),
    skill VARCHAR(255),
    FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE
);

${resumes.map(r => `
INSERT INTO resumes (id, name, email, phone, summary, raw_text, embedding, file_name, file_type, upload_date)
VALUES ('${r.id}', '${r.name?.replace(/'/g, "\\'")}', '${r.email?.replace(/'/g, "\\'")}', '${r.phone?.replace(/'/g, "\\'")}', '${r.summary?.replace(/'/g, "\\'")}', '${r.rawText?.replace(/'/g, "\\'")}', '${r.embedding?.replace(/'/g, "\\'")}', '${r.fileName?.replace(/'/g, "\\'")}', '${r.fileType?.replace(/'/g, "\\'")}', '${r.uploadDate}');
${r.education?.map(edu => `INSERT INTO education (resume_id, degree) VALUES ('${r.id}', '${edu.replace(/'/g, "\\'")}');`).join('\n')}
${r.experience?.map(exp => `INSERT INTO experience (resume_id, experience) VALUES ('${r.id}', '${exp.replace(/'/g, "\\'")}');`).join('\n')}
${r.skills?.map(skill => `INSERT INTO skills (resume_id, skill) VALUES ('${r.id}', '${skill.replace(/'/g, "\\'")}');`).join('\n')}
`).join('\n')}
`;
};