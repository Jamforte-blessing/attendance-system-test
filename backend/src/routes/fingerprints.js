const router = require('express').Router();
const { query, queryOne, execute } = require('../database');

const FINGER_NAMES = {
  1: 'Right Thumb', 2: 'Right Index', 3: 'Right Middle', 4: 'Right Ring', 5: 'Right Little',
  6: 'Left Thumb', 7: 'Left Index', 8: 'Left Middle', 9: 'Left Ring', 10: 'Left Little',
};

router.get('/employee/:employeeId', async (req, res, next) => {
  try {
    const rows = await query(`
      SELECT f.*, d.name as device_name
      FROM fingerprints f
      LEFT JOIN devices d ON d.id = f.device_id
      WHERE f.employee_id = $1
      ORDER BY f.finger_index
    `, [req.params.employeeId]);
    res.json(rows.map(f => ({ ...f, finger_name: FINGER_NAMES[f.finger_index] })));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { employee_id, device_id, finger_index, template } = req.body;
    if (!employee_id) return res.status(400).json({ error: 'employee_id is required' });

    const employee = await queryOne('SELECT id FROM employees WHERE id = $1', [employee_id]);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    if (device_id) {
      const device = await queryOne('SELECT id FROM devices WHERE id = $1', [device_id]);
      if (!device) return res.status(404).json({ error: 'Device not found' });
    }

    const result = await execute(
      'INSERT INTO fingerprints (employee_id, device_id, finger_index, template) VALUES ($1, $2, $3, $4) RETURNING id',
      [employee_id, device_id || null, finger_index || 1, template || null]
    );
    await execute('INSERT INTO audit_logs (action, entity, entity_id, details) VALUES ($1, $2, $3, $4)',
      ['ENROLL', 'fingerprint', result.id,
        JSON.stringify({ employee_id, finger_index, finger_name: FINGER_NAMES[finger_index || 1] })]);

    res.status(201).json({ id: result.id, finger_name: FINGER_NAMES[finger_index || 1] });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const fp = await queryOne('SELECT * FROM fingerprints WHERE id = $1', [req.params.id]);
    if (!fp) return res.status(404).json({ error: 'Fingerprint not found' });

    await execute('DELETE FROM fingerprints WHERE id = $1', [req.params.id]);
    await execute('INSERT INTO audit_logs (action, entity, entity_id, details) VALUES ($1, $2, $3, $4)',
      ['DELETE', 'fingerprint', req.params.id, JSON.stringify({ employee_id: fp.employee_id })]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
