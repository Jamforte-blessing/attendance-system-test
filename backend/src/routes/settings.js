const router = require('express').Router();
const { query, execute } = require('../database');

router.get('/', async (_req, res, next) => {
  try {
    const rows = await query('SELECT "key", value FROM settings');
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) { next(err); }
});

router.put('/', async (req, res, next) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      await execute(
        'INSERT INTO settings ("key", value) VALUES ($1, $2) ON CONFLICT ("key") DO UPDATE SET value = EXCLUDED.value',
        [key, String(value)]
      );
    }
    await execute('INSERT INTO audit_logs (action, entity, entity_id, details) VALUES ($1, $2, $3, $4)',
      ['UPDATE', 'settings', null, JSON.stringify(req.body)]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
