const router = require('express').Router();
const reportController = require('./report.controller');

router.get('/summary', reportController.summary);
router.get('/daily', reportController.daily);
router.get('/export', reportController.exportCsv);
router.get('/audit', reportController.audit);

module.exports = router;
