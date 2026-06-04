const adminAccountsService = require('./adminAccounts.service');

async function list(_req, res, next) {
  try {
    res.json(await adminAccountsService.getAll());
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { username, company_ids } = req.body;
    if (!username) return res.status(400).json({ error: 'Username is required' });

    const result = await adminAccountsService.create({ username, company_ids });
    res.status(201).json({
      id: result.id,
      username: result.username,
      generated_password: result.generated_password,
      created_at: result.created_at,
    });
  } catch (err) {
    if (err.reserved) return res.status(409).json({ error: err.message });
    if (err.validation) return res.status(400).json({ error: err.message });
    if (err.code === '23505') return res.status(409).json({ error: 'Username already exists' });
    if (err.code === '23503') return res.status(400).json({ error: 'One or more selected companies do not exist' });
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
