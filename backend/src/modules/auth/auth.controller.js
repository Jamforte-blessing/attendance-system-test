const authService = require('./auth.service');

async function loginHandler(req, res) {
  try {
    const { username, email, password } = req.body;
    const result = await authService.login({ username, email, password });
    if (!result) return res.status(401).json({ error: 'Invalid username or password' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
}

async function changePasswordHandler(req, res) {
  try {
    const { newPassword } = req.body;
    const employee_id = req.user?.employee_id;
    if (!employee_id) return res.status(403).json({ error: 'Not authorized' });
    await authService.changePassword({ employee_id, newPassword });
    res.json({ success: true });
  } catch (err) {
    if (err.message.includes('at least')) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Password change failed' });
  }
}

async function forgotPasswordHandler(req, res) {
  try {
    const { email } = req.body;
    await authService.forgotPassword({ email });
    res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    if (err.message.includes('required')) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Password reset request failed' });
  }
}

async function resetPasswordHandler(req, res) {
  try {
    const { token, newPassword } = req.body;
    await authService.resetPassword({ token, newPassword });
    res.json({ success: true, message: 'Password updated. You can now log in.' });
  } catch (err) {
    if (err.message.includes('required') || err.message.includes('characters')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.message.includes('invalid or has expired')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Password reset failed' });
  }
}

async function registerFaceHandler(req, res) {
  try {
    const employee_db_id = req.user?.employee_db_id;
    if (!employee_db_id) return res.status(403).json({ error: 'Not authorized' });
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'image is required' });
    await authService.registerFace({ employee_db_id, image });
    res.json({ success: true });
  } catch (err) {
    if (err.message === 'Face already registered') return res.status(409).json({ error: err.message });
    if (err.message === 'Employee not found') return res.status(404).json({ error: err.message });
    res.status(500).json({ error: err.message || 'Face registration failed' });
  }
}

module.exports = { loginHandler, changePasswordHandler, forgotPasswordHandler, resetPasswordHandler, registerFaceHandler };
