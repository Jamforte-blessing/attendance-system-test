const router = require('express').Router();
const adminAccountsController = require('./adminAccounts.controller');

router.get('/', adminAccountsController.list);
router.post('/', adminAccountsController.create);
router.delete('/:username', adminAccountsController.remove);

module.exports = router;
