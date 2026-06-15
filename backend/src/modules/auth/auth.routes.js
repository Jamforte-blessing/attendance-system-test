const router = require('express').Router();
const authController = require('./auth.controller');
const authMiddleware = require('../../shared/middleware/auth');

router.post('/login', authController.loginHandler);
router.post('/forgot-password', authController.forgotPasswordHandler);
router.post('/reset-password', authController.resetPasswordHandler);
router.post('/change-password', authMiddleware, authController.changePasswordHandler);
router.post('/register-face', authMiddleware, authController.registerFaceHandler);

module.exports = router;
