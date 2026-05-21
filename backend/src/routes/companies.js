const router = require('express').Router();
const { query, queryOne, execute } = require('../database');

router.get('/', async (req, res, next) => {
  try {
    const companies = await query(`
      SELECT c.*,
             COUNT(DISTINCT e.id)::int as employee_count,
             COUNT(DISTINCT d.id)::int as department_count
      FROM companies c
      LEFT JOIN employees e ON e.company_id = c.id AND e.status = 'active'
      LEFT JOIN departments d ON d.company_id = c.id
      GROUP BY c.id
      ORDER BY c.name
    `);
    res.json(companies);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const company = await queryOne('SELECT * FROM companies WHERE id = $1', [req.params.id]);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    res.json(company);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, address, latitude, longitude, radius_meters } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const result = await execute(
      `INSERT INTO companies (name, address, latitude, longitude, radius_meters) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [name.trim(), address || null, latitude || null, longitude || null, radius_meters || 100]
    );
    await execute(
      'INSERT INTO audit_logs (action, entity, entity_id, details) VALUES ($1, $2, $3, $4)',
      ['CREATE', 'company', result.id, JSON.stringify({ name })]
    );
    res.status(201).json({ id: result.id, name });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Company name already exists' });
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, address, radius_meters } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const company = await queryOne('SELECT id FROM companies WHERE id = $1', [req.params.id]);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    await execute(
      `UPDATE companies SET name = $1, address = $2, radius_meters = $3 WHERE id = $4`,
      [name.trim(), address || null, radius_meters || 100, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Company name already exists' });
    next(err);
  }
});

router.patch('/:id/location', async (req, res, next) => {
  try {
    const { latitude, longitude, radius_meters } = req.body;
    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: 'latitude and longitude are required' });
    }

    await execute(
      `UPDATE companies SET latitude = $1, longitude = $2, radius_meters = $3 WHERE id = $4`,
      [latitude, longitude, radius_meters || 100, req.params.id]
    );
    res.json({ success: true, latitude, longitude, radius_meters: radius_meters || 100 });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const company = await queryOne('SELECT id FROM companies WHERE id = $1', [req.params.id]);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    await execute('UPDATE employees SET company_id = NULL WHERE company_id = $1', [req.params.id]);
    await execute('UPDATE departments SET company_id = NULL WHERE company_id = $1', [req.params.id]);
    await execute('DELETE FROM companies WHERE id = $1', [req.params.id]);

    await execute(
      'INSERT INTO audit_logs (action, entity, entity_id, details) VALUES ($1, $2, $3, $4)',
      ['DELETE', 'company', req.params.id, null]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.get('/:id/departments', async (req, res, next) => {
  try {
    const depts = await query(
      `SELECT d.*, COUNT(e.id)::int as employee_count
       FROM departments d
       LEFT JOIN employees e ON e.department_id = d.id AND e.status = 'active'
       WHERE d.company_id = $1
       GROUP BY d.id
       ORDER BY d.name`,
      [req.params.id]
    );
    res.json(depts);
  } catch (err) { next(err); }
});

router.post('/:id/departments', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const result = await execute(
      'INSERT INTO departments (name, company_id) VALUES ($1, $2) RETURNING id',
      [name.trim(), req.params.id]
    );
    res.status(201).json({ id: result.id, name, company_id: parseInt(req.params.id) });
  } catch (err) { next(err); }
});

router.delete('/:companyId/departments/:deptId', async (req, res, next) => {
  try {
    await execute('UPDATE employees SET department_id = NULL WHERE department_id = $1', [req.params.deptId]);
    await execute('DELETE FROM departments WHERE id = $1 AND company_id = $2', [req.params.deptId, req.params.companyId]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
