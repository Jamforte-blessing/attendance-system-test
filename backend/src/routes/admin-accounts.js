const router = require('express').Router();
const crypto = require('crypto');
const { query, execute } = require('../database');

const hashPassword = (password) => new Promise((resolve, reject) => {
  const salt = crypto.randomBytes(16).toString('hex');
  crypto.scrypt(password, salt, 64, (err, key) => {
    if (err) reject(err);
    else resolve(`${salt}:${key.toString('hex')}`);
  });
});

router.get('/', async (req, res, next) => {
  try {
    const admins = await query('SELECT id, username, created_at FROM admins ORDER BY created_at');
    res.json(admins);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const superAdmin = process.env.ADMIN_USERNAME || 'admin';
    if (username === superAdmin) return res.status(409).json({ error: 'Username is reserved' });

    const hash = await hashPassword(password);
    const result = await execute(
      'INSERT INTO admins (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
      [username.trim(), hash]
    );
    res.status(201).json({ id: result.id, username: result.username, created_at: result.created_at });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username already exists' });
    next(err);
  }
});

router.delete('/:username', async (req, res, next) => {
  try {
    const { username } = req.params;
    const superAdmin = process.env.ADMIN_USERNAME || 'admin';
    if (username === superAdmin) return res.status(403).json({ error: 'Cannot delete the primary admin' });

    await execute('DELETE FROM admins WHERE username = $1', [username]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
