// src/modules/attendance/face.service.js
const axios = require('axios');
const { query, queryOne, execute } = require('../../shared/database');

// Configuration for the Python ONNX worker
const AI_WORKER_URL = process.env.AI_WORKER_URL || 'http://localhost:5001';

/**
 * Sends image to the Python worker for processing.
 * Returns: { success: boolean, embedding: number[], is_live: boolean, error?: string }
 */
async function processImageBuffer(imageBuffer) {
  try {
    // In a real scenario, you might save the file temporarily or send base64
    // Here we assume the Python worker accepts a base64 image
    const response = await axios.post(`${AI_WORKER_URL}/process`, {
      image: imageBuffer.toString('base64')
    }, { timeout: 5000 });

    return response.data;
  } catch (error) {
    console.error('AI Worker Error:', error.message);
    throw new Error('Face recognition service unavailable');
  }
}

/**
 * Calculates Euclidean distance between two vectors.
 * Threshold ~0.6-0.8 typically used for InsightFace.
 */
function calculateDistance(vec1, vec2) {
  let sum = 0;
  for (let i = 0; i < vec1.length; i++) {
    sum += Math.pow(vec1[i] - vec2[i], 2);
  }
  return Math.sqrt(sum);
}

/**
 * Finds the best matching employee for a given face vector.
 */
async function identifyEmployee(inputVector) {
  // Fetch all employees with registered faces
  // Note: For large scale, use PostgreSQL pgvector extension for nearest neighbor search
  const employees = await query('SELECT id, name, face_vector FROM employees WHERE face_vector IS NOT NULL');
  
  let bestMatch = null;
  let minDistance = 1.0; // Threshold (lower is stricter, 1.0 is loose)

  for (const emp of employees) {
    // Parse stored vector (assuming stored as JSON array string or Buffer)
    let storedVector = emp.face_vector;
    if (Buffer.isBuffer(storedVector)) {
        storedVector = Array.from(new Float32Array(storedVector));
    } else if (typeof storedVector === 'string') {
        storedVector = JSON.parse(storedVector);
    }

    const distance = calculateDistance(inputVector, storedVector);
    
    if (distance < minDistance) {
      minDistance = distance;
      bestMatch = emp;
    }
  }

  return bestMatch;
}

module.exports = { processImageBuffer, identifyEmployee, calculateDistance };