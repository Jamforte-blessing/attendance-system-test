const crypto = require('crypto');
const { query, execute } = require('../../shared/database');

const hashPassword = (password) => new Promise((resolve, reject) => {
  const salt = crypto.randomBytes(16).toString('hex');
  crypto.scrypt(password, salt, 64, (err, key) => {
    if (err) reject(err);
    else resolve(`${salt}:${key.toString('hex')}`);
  });
});

async function getAll() {
  return query('SELECT id, username, created_at FROM admins ORDER BY created_at');
}

async function create({ username, password }) {
  const superAdmin = process.env.ADMIN_USERNAME || 'admin';
  if (username === superAdmin) {
    throw Object.assign(new Error('Username is reserved'), { reserved: true });
  }

  const hash = await hashPassword(password);
  return execute(
    'INSERT INTO admins (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
    [username.trim(), hash]
  );
}

async function remove(username) {
  const superAdmin = process.env.ADMIN_USERNAME || 'admin';
  if (username === superAdmin) {
    throw Object.assign(new Error('Cannot delete the primary admin'), { forbidden: true });
  }
  await execute('DELETE FROM admins WHERE username = $1', [username]);
}

module.exports = { getAll, create, remove };
