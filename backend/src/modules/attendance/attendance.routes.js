const router = require('express').Router();
const attendanceController = require('./attendance.controller');
const multer = require('multer'); // 1. Import multer first

// 2. Configure upload middleware (memory storage keeps the file in a buffer)
const upload = multer({ storage: multer.memoryStorage() });

// --- Existing Routes ---
router.get('/', attendanceController.list);
router.get('/today', attendanceController.today);
router.get('/employee/:id', attendanceController.byEmployee);
router.post('/manual', attendanceController.manual);
router.delete('/:id', attendanceController.deleteLog);

// --- New Face Recognition Routes ---
// 'upload.single('face')' processes the incoming image file and makes it available as req.file
router.post('/register-face', upload.single('face'), attendanceController.registerFace);
router.post('/clock-face', upload.single('face'), attendanceController.clockFace);

module.exports = router;