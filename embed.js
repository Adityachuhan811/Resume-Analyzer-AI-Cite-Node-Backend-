// embed.js
const crypto = require('crypto');

// Creates a fake vector embedding based on text hash
// In production, you would replace this with OpenAI or HuggingFace embeddings
function mockEmbedding(text, dim = 128) {
  const safeText = text || '';
  const hash = crypto.createHash('sha256').update(safeText).digest();
  
  const vec = new Array(dim);
  for (let i = 0; i < dim; i++) {
    // Convert byte to range -1 to 1
    const byte = hash[i % hash.length];
    vec[i] = (byte / 255) * 2 - 1;
  }
  
  // Normalize vector
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  for (let i = 0; i < dim; i++) vec[i] = vec[i] / norm;
  
  return vec;
}

async function getEmbedding(text) {
  return mockEmbedding(text, 128);
}

function cosine(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0) return 0;
  
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

module.exports = { getEmbedding, cosine };