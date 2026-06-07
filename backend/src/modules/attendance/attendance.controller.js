const attendanceService = require('./attendance.service');
const multer = require('multer');

// Configure Multer to store files in memory (Buffer) instead of disk
// This is necessary because we need to pass the buffer directly to the AI service
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed.'), false);
    }
    cb(null, true);
  }
});

async function list(req, res, next) {
  try {
    res.json(await attendanceService.getLogs(req.query, req.user));
  } catch (err) { next(err); }
}

async function today(req, res, next) {
  try {
    res.json(await attendanceService.getTodayLogs(req.user));
  } catch (err) { next(err); }
}

async function byEmployee(req, res, next) {
  try {
    res.json(await attendanceService.getEmployeeLogs(req.params.id, req.query, req.user));
  } catch (err) { next(err); }
}

async function manual(req, res, next) {
  try {
    const { employee_id, type } = req.body;
    if (!employee_id || !type) return res.status(400).json({ error: 'employee_id and type are required' });
    if (!['clock_in', 'clock_out'].includes(type)) return res.status(400).json({ error: 'type must be clock_in or clock_out' });

    const record = await attendanceService.createManualLog(req.body, req.user);
    res.status(201).json(record);
  } catch (err) { next(err); }
}

async function deleteLog(req, res, next) {
  try {
    const result = await attendanceService.deleteLog(req.params.id, req.user);
    if (!result) return res.status(404).json({ error: 'Log not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
}

// ==========================================
// FACE RECOGNITION CONTROLLERS
// ==========================================

async function registerFace(req, res, next) {
  try {
    // req.file is populated by multer middleware
    if (!req.file) return res.status(400).json({ error: 'Image file is required' });
    
    const { employee_id } = req.body;
    if (!employee_id) return res.status(400).json({ error: 'employee_id is required' });

    const result = await attendanceService.registerFace(employee_id, req.file.buffer, req.user);
    res.json(result);
  } catch (err) { next(err); }
}

async function clockFace(req, res, next) {
  try {
    // req.file is populated by multer middleware
    if (!req.file) return res.status(400).json({ error: 'Image file is required' });

    const result = await attendanceService.clockViaFace(req.file.buffer, req.user);
    res.status(201).json(result);
  } catch (err) { next(err); }
}

module.exports = { 
  list, 
  today, 
  byEmployee, 
  manual, 
  deleteLog,
  upload, // Export upload for use in routes
  registerFace, 
  clockFace 
};