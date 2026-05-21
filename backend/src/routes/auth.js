const router = require('express').Router();
const jwt = require('jsonwebtoken');

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  if (username !== adminUsername || password !== adminPassword) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = jwt.sign(
    { role: 'admin', username },
    process.env.JWT_SECRET || 'changeme',
    { expiresIn: '8h' }
  );

  res.json({ token });
});

module.exports = router;
