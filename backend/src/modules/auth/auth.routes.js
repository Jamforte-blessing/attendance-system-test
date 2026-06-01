const router = require('express').Router();
const authController = require('./auth.controller');

router.post('/login', authController.loginHandler);

module.exports = router;
