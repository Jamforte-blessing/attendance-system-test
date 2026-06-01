const router = require('express').Router();
const dashboardController = require('./dashboard.controller');

router.get('/stats', dashboardController.stats);
router.get('/notifications', dashboardController.notifications);
router.get('/live', dashboardController.live);

module.exports = router;
