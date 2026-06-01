const router = require('express').Router();
const kioskController = require('./kiosk.controller');

router.get('/companies', kioskController.companies);
router.get('/departments', kioskController.departments);
router.get('/employees', kioskController.employees);
router.get('/status/:employeeId', kioskController.status);
router.post('/scan', kioskController.scan);

module.exports = router;
