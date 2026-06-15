import os
import cv2
import numpy as np
import base64
from flask import Flask, request, jsonify
from insightface.app import FaceAnalysis

app = Flask(__name__)

# --- 1. LOAD MODELS ---
print("Loading InsightFace models (SCRFD + ArcFace)...")
# This will automatically download models to ~/.insightface/models/ on first run
# providers=['CPUExecutionProvider'] ensures it runs on your CPU
try:
    face_analyzer = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
    face_analyzer.prepare(ctx_id=0, det_size=(640, 640))
    print("InsightFace models loaded successfully.")
except Exception as e:
    print(f"CRITICAL ERROR loading InsightFace: {e}")
    face_analyzer = None

# --- 2. LOAD ANTI-SPOOFING MODEL (Optional) ---
# We check if the file exists. If not, liveness check is skipped.
SPOOF_MODEL_PATH = os.path.join(os.path.dirname(__file__), 'models', 'anti_spoof.onnx')
spoof_session = None

if os.path.exists(SPOOF_MODEL_PATH):
    try:
        import onnxruntime as ort
        spoof_session = ort.InferenceSession(SPOOF_MODEL_PATH)
        print(f"Anti-Spoofing model loaded.")
    except Exception as e:
        print(f"Warning: Could not load anti-spoofing model: {e}")
else:
    print("Warning: 'models/anti_spoof.onnx' not found. Liveness detection DISABLED.")

def check_liveness(face_img):
    """Runs anti-spoofing inference."""
    if spoof_session is None:
        return True # Pass automatically if model is missing

    try:
        # Basic preprocessing for Silent-Face model (80x80)
        h, w = 80, 80
        face_resized = cv2.resize(face_img, (h, w))
        face_normalized = (face_resized - 127.5) / 127.5
        face_input = face_normalized.transpose(2, 0, 1).astype(np.float32)
        face_input = np.expand_dims(face_input, axis=0)

        # Run Inference
        input_name = spoof_session.get_inputs()[0].name
        output = spoof_session.run(None, {input_name: face_input})[0]
        
        # Calculate probability (Softmax)
        exp_out = np.exp(output[0])
        probs = exp_out / np.sum(exp_out)
        
        # Assuming index 0 is 'Real' probability (Check your specific model docs)
        real_prob = probs[0]
        
        return real_prob > 0.8 # Threshold (80% sure it's a real face)
    except Exception as e:
        print(f"Liveness error: {e}")
        return False

# --- 3. API ENDPOINT ---
@app.route('/process', methods=['POST'])
def process_image():
    if face_analyzer is None:
        return jsonify({'success': False, 'error': 'AI Models not initialized'}), 500

    try:
        # A. Decode Image
        data = request.json
        if not data or 'image' not in data:
            return jsonify({'success': False, 'error': 'No image provided'}), 400

        img_bytes = base64.b64decode(data['image'])
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return jsonify({'success': False, 'error': 'Invalid image data'}), 400

        # B. Detect Face
        faces = face_analyzer.get(img)

        if len(faces) == 0:
            return jsonify({'success': False, 'error': 'No face detected'})
        
        # We process only the first (largest) face
        face = faces[0]

        # C. Liveness Check
        box = face.bbox.astype(int)
        x1, y1, x2, y2 = max(0, box[0]), max(0, box[1]), box[2], box[3]
        
        is_live = True
        if y2 > y1 and x2 > x1: # Check valid crop dimensions
            face_crop = img[y1:y2, x1:x2]
            if face_crop.size > 0:
                is_live = check_liveness(face_crop)
        
        if not is_live:
            return jsonify({'success': False, 'error': 'Spoof attempt detected', 'is_live': False})

        # D. Return Embedding
        embedding = face.embedding.tolist()

        return jsonify({
            'success': True,
            'embedding': embedding,
            'is_live': True
        })

    except Exception as e:
        print(f"Server Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)