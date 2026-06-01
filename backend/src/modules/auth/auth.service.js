const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { queryOne } = require('../../shared/database');

const verifyPassword = (password, stored) => new Promise((resolve, reject) => {
  const [salt, hash] = stored.split(':');
  crypto.scrypt(password, salt, 64, (err, key) => {
    if (err) reject(err);
    else resolve(key.toString('hex') === hash);
  });
});

const signToken = username =>
  jwt.sign({ role: 'admin', username }, process.env.JWT_SECRET || 'changeme', { expiresIn: '8h' });

async function login({ username, password }) {
  const envUsername = process.env.ADMIN_USERNAME || 'admin';
  const envPassword = process.env.ADMIN_PASSWORD || 'admin123';

  if (username === envUsername && password === envPassword) {
    return signToken(username);
  }

  const admin = await queryOne('SELECT * FROM admins WHERE username = $1', [username]);
  if (admin && await verifyPassword(password, admin.password_hash)) {
    return signToken(username);
  }

  return null;
}

module.exports = { login };
