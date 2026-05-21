const router = require('express').Router();
const { query, queryOne, execute } = require('../database');

router.get('/', async (req, res, next) => {
  try {
    const devices = await query(`
      SELECT d.*,
        (SELECT COUNT(*)::int FROM fingerprints f WHERE f.device_id = d.id) as fingerprint_count
      FROM devices d
      ORDER BY d.name
    `);
    const now = Date.now();
    const withStatus = devices.map(d => ({
      ...d,
      online: d.last_seen
        ? (now - new Date(d.last_seen).getTime()) < 5 * 60 * 1000
        : false,
    }));
    res.json(withStatus);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const device = await queryOne('SELECT * FROM devices WHERE id = $1', [req.params.id]);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json(device);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { device_id, name, location, ip_address } = req.body;
    if (!device_id || !name) return res.status(400).json({ error: 'device_id and name are required' });

    const result = await execute(
      'INSERT INTO devices (device_id, name, location, ip_address) VALUES ($1, $2, $3, $4) RETURNING id',
      [device_id, name, location || null, ip_address || null]
    );
    await execute('INSERT INTO audit_logs (action, entity, entity_id, details) VALUES ($1, $2, $3, $4)',
      ['REGISTER', 'device', result.id, JSON.stringify({ device_id, name, location })]);
    res.status(201).json({ id: result.id, device_id, name });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Device ID already registered' });
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, location, ip_address, status } = req.body;
    const device = await queryOne('SELECT id FROM devices WHERE id = $1', [req.params.id]);
    if (!device) return res.status(404).json({ error: 'Device not found' });

    await execute(
      'UPDATE devices SET name=$1, location=$2, ip_address=$3, status=$4 WHERE id=$5',
      [name, location || null, ip_address || null, status || 'active', req.params.id]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await execute(`UPDATE devices SET status='inactive' WHERE id=$1`, [req.params.id]);
    await execute('INSERT INTO audit_logs (action, entity, entity_id, details) VALUES ($1, $2, $3, $4)',
      ['DEACTIVATE', 'device', req.params.id, null]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
