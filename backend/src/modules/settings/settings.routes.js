const router = require('express').Router();
const settingsController = require('./settings.controller');

router.get('/', settingsController.getAll);
router.put('/', settingsController.updateAll);

module.exports = router;
