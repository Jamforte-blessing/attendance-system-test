const adminAccountsService = require('./adminAccounts.service');

async function list(_req, res, next) {
  try {
    res.json(await adminAccountsService.getAll());
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const result = await adminAccountsService.create({ username, password });
    res.status(201).json({ id: result.id, username: result.username, created_at: result.created_at });
  } catch (err) {
    if (err.reserved) return res.status(409).json({ error: err.message });
    if (err.code === '23505') return res.status(409).json({ error: 'Username already exists' });
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await adminAccountsService.remove(req.params.username);
    res.json({ success: true });
  } catch (err) {
    if (err.forbidden) return res.status(403).json({ error: err.message });
    next(err);
  }
}

module.exports = { list, create, remove };
