const axios = require('axios'); // CHANGED from import to require
const { query, queryOne, execute } = require('../../shared/database'); // CHANGED from import to require

const AI_WORKER_URL = process.env.AI_WORKER_URL || 'http://localhost:5001/process';

async function processImageBuffer(imageBuffer) {
  try {
    const base64Image = imageBuffer.toString('base64');
    
    // Prepare headers
    const headers = {
      'Content-Type': 'application/json'
    };

    // Add Security Key if configured in .env
    if (process.env.AI_WORKER_KEY) {
      headers['X-Worker-Key'] = process.env.AI_WORKER_KEY;
    }

    const response = await axios.post(AI_WORKER_URL, {
      image: base64Image
    }, {
      headers: headers, 
      timeout: 30000 
    });

    return response.data; 
  } catch (error) {
    console.error('AI Worker Error:', error.message);
    if (error.response && error.response.data) {
        return { success: false, error: error.response.data.error || 'Request failed' };
    }
    return { success: false, error: 'Face recognition service unavailable' };
  }
}

function calculateDistance(vec1, vec2) {
  let sum = 0;
  for (let i = 0; i < vec1.length; i++) {
    sum += Math.pow(vec1[i] - vec2[i], 2);
  }
  return Math.sqrt(sum);
}

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

  const inputNorm = normalizeVector(inputVector);
  
  let bestMatch = null;
  let minDistance = 1.2; 

  for (const emp of employees) {
    const buffer = Buffer.isBuffer(emp.face_vector) 
      ? emp.face_vector 
      : Buffer.from(emp.face_vector);

    const storedVector = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
    const storedArray = Array.from(storedVector);
    const storedNorm = normalizeVector(storedArray);
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