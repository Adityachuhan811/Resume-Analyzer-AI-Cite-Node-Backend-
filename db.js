// db.js
const fs = require('fs').promises;
const path = require('path');

const dataDir = path.join(__dirname, 'data');
const dbFile = path.join(dataDir, 'resumes.json');

// Helper to read DB
async function readDb() {
  try {
    const data = await fs.readFile(dbFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { resumes: [], lastId: 0 };
  }
}

// Helper to write DB
async function writeDb(data) {
  await fs.writeFile(dbFile, JSON.stringify(data, null, 2));
}

async function init() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    try {
      await fs.access(dbFile);
    } catch {
      await writeDb({ resumes: [], lastId: 0 });
    }
  } catch (err) {
    console.error("DB Init Failed:", err);
  }
}

async function insertResume(resumeObj) {
  const db = await readDb();
  db.lastId += 1;
  const newResume = {
    id: db.lastId.toString(),
    ...resumeObj,
    created_at: new Date().toISOString()
  };
  db.resumes.push(newResume);
  await writeDb(db);
  return { insertId: newResume.id };
}

async function getAllResumes() {
  const db = await readDb();
  return db.resumes;
}

async function getResumeById(id) {
  const db = await readDb();
  return db.resumes.find(r => r.id === String(id));
}

module.exports = { init, insertResume, getAllResumes, getResumeById };