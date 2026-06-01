const router = require('express').Router();
const analyticsController = require('./analytics.controller');

router.get('/', analyticsController.analytics);

module.exports = router;
