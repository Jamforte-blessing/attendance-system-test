const authService = require('./auth.service');

async function loginHandler(req, res) {
  try {
    const { username, password } = req.body;
    const token = await authService.login({ username, password });
    if (!token) return res.status(401).json({ error: 'Invalid username or password' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
}

module.exports = { loginHandler };
