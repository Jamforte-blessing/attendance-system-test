const router = require('express').Router();
const kioskController = require('./kiosk.controller');

router.get('/companies', kioskController.companies);
router.get('/departments', kioskController.departments);
router.get('/units', kioskController.units);
router.get('/employees', kioskController.employees);
router.get('/status/:employeeId', kioskController.status);
router.get('/insights/:employeeId', kioskController.insights);
router.post('/scan', kioskController.scan);

module.exports = router;
