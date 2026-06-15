const http = require('http');
const https = require('https');

function getWorkerUrl() {
  return process.env.FACE_WORKER_URL || 'http://localhost:5001';
}

function callFaceWorker(base64Image) {
  return new Promise((resolve, reject) => {
    const base = getWorkerUrl();
    const url = new URL('/process', base);
    const body = JSON.stringify({ image: base64Image });
    const lib = url.protocol === 'https:' ? https : http;

    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch {
          reject(new Error('Invalid JSON from face worker'));
        }
      });
    });

    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Face worker timed out'));
    });

    req.on('error', (err) => reject(new Error(`Face worker unreachable: ${err.message}`)));
    req.write(body);
    req.end();
  });
}

function embeddingToBuffer(embedding) {
  const arr = new Float32Array(embedding);
  return Buffer.from(arr.buffer);
}

function bufferToEmbedding(buf) {
  // pg returns BYTEA as a Buffer
  const arr = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  return Array.from(arr);
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Strip data URI prefix if present, e.g. "data:image/jpeg;base64,..."
function stripDataUri(image) {
  return image.replace(/^data:image\/[a-z]+;base64,/, '');
}

async function processImage(image) {
  const base64 = stripDataUri(image);
  const result = await callFaceWorker(base64);
  if (!result.success) {
    throw new Error(result.error || 'Face processing failed');
  }
  return {
    embedding: result.embedding,
    is_live: result.is_live,
    buffer: embeddingToBuffer(result.embedding),
  };
}

// Returns { matched: bool, score: float }
function verifyEmbedding(newEmbedding, storedBuffer) {
  const stored = bufferToEmbedding(storedBuffer);
  const score = cosineSimilarity(newEmbedding, stored);
  return { matched: score >= 0.4, score: Math.round(score * 1000) / 1000 };
}

module.exports = { processImage, verifyEmbedding };
