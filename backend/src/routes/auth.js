const router = require('express').Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { queryOne } = require('../database');

const verifyPassword = (password, stored) => new Promise((resolve, reject) => {
  const [salt, hash] = stored.split(':');
  crypto.scrypt(password, salt, 64, (err, key) => {
    if (err) reject(err);
    else resolve(key.toString('hex') === hash);
  });
});

const signToken = username =>
  jwt.sign({ role: 'admin', username }, process.env.JWT_SECRET || 'changeme', { expiresIn: '8h' });

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const envUsername = process.env.ADMIN_USERNAME || 'admin';
    const envPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (username === envUsername && password === envPassword) {
      return res.json({ token: signToken(username) });
    }

    const admin = await queryOne('SELECT * FROM admins WHERE username = $1', [username]);
    if (admin && await verifyPassword(password, admin.password_hash)) {
      return res.json({ token: signToken(username) });
    }

    res.status(401).json({ error: 'Invalid username or password' });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;
