const axios = require('axios');
const { query, queryOne, execute } = require('../../shared/database');

const AI_WORKER_URL = process.env.AI_WORKER_URL || 'http://localhost:5001/process';

async function processImageBuffer(imageBuffer) {
  try {
    const base64Image = imageBuffer.toString('base64');
    const response = await axios.post(AI_WORKER_URL, {
      image: base64Image
    }, {
      timeout: 30000 
    });

    return response.data; 
  } catch (error) {
    console.error('AI Worker Error:', error.message);
    return { success: false, error: 'Face recognition service unavailable' };
  }
}

/**
 * Calculates Euclidean distance between two vectors.
 */
function calculateDistance(vec1, vec2) {
  let sum = 0;
  for (let i = 0; i < vec1.length; i++) {
    sum += Math.pow(vec1[i] - vec2[i], 2);
  }
  return Math.sqrt(sum);
}

/**
 * Normalizes a vector to unit length (magnitude = 1).
 * This is crucial for InsightFace comparisons.
 */
function normalizeVector(vec) {
    const magnitude = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) return vec;
    return vec.map(val => val / magnitude);
}

async function identifyEmployee(inputVector, companyIds) {
  if (!companyIds || companyIds.length === 0) return null;

  const employees = await query(
    'SELECT id, name, face_vector FROM employees WHERE company_id = ANY($1) AND face_vector IS NOT NULL',
    [companyIds]
  );
  
  if (employees.length === 0) return null;

  // Normalize the input vector ONCE before comparing
  const inputNorm = normalizeVector(inputVector);
  
  let bestMatch = null;
  let minDistance = 1.2; // Threshold

  for (const emp of employees) {
    // --- CRITICAL FIX STARTS HERE ---
    
    // 1. Ensure we have a Buffer
    const buffer = Buffer.isBuffer(emp.face_vector) 
      ? emp.face_vector 
      : Buffer.from(emp.face_vector);

    // 2. Create a Float32Array view on the buffer's memory
    // This interprets the 2048 bytes correctly as 512 floats
    const storedVector = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
    
    // 3. Convert to standard Array for math operations
    const storedArray = Array.from(storedVector);
    
    // --- CRITICAL FIX ENDS HERE ---

    // 4. Normalize stored vector
    const storedNorm = normalizeVector(storedArray);
    
    // 5. Calculate distance
    const distance = calculateDistance(inputNorm, storedNorm);

    console.log(`Comparing with ${emp.name}: Distance = ${distance.toFixed(4)}`);

    if (distance < minDistance) {
      minDistance = distance;
      bestMatch = emp;
    }
  }

  if (bestMatch) {
    console.log(`SUCCESS: Matched ${bestMatch.name} with distance ${minDistance.toFixed(4)}`);
  } else {
    console.log('FAIL: No face matched the threshold (1.2)');
  }

  return bestMatch;
}

module.exports = { processImageBuffer, identifyEmployee, calculateDistance };