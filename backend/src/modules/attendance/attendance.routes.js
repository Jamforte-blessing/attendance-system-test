const router = require('express').Router();
const attendanceController = require('./attendance.controller');

router.get('/', attendanceController.list);
router.get('/today', attendanceController.today);
router.get('/employee/:id', attendanceController.byEmployee);
router.post('/manual', attendanceController.manual);
router.delete('/:id', attendanceController.deleteLog);

module.exports = router;
