const router = require('express').Router();
const { query, queryOne, execute } = require('../database');

router.get('/', async (req, res, next) => {
  try {
    const { company_id } = req.query;
    let sql = `
      SELECT d.*, c.name as company_name, COUNT(e.id)::int as employee_count
      FROM departments d
      LEFT JOIN companies c ON c.id = d.company_id
      LEFT JOIN employees e ON e.department_id = d.id AND e.status = 'active'
      WHERE 1=1
    `;
    const params = [];
    if (company_id) { sql += ` AND d.company_id = $${params.length + 1}`; params.push(company_id); }
    sql += ' GROUP BY d.id, c.name ORDER BY d.name';

    res.json(await query(sql, params));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, company_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const result = await execute(
      'INSERT INTO departments (name, company_id) VALUES ($1, $2) RETURNING id',
      [name.trim(), company_id || null]
    );
    await execute(
      'INSERT INTO audit_logs (action, entity, entity_id, details) VALUES ($1, $2, $3, $4)',
      ['CREATE', 'department', result.id, JSON.stringify({ name, company_id })]
    );
    res.status(201).json({ id: result.id, name, company_id: company_id || null });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, company_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    await execute(
      'UPDATE departments SET name = $1, company_id = $2 WHERE id = $3',
      [name.trim(), company_id || null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await execute('UPDATE employees SET department_id = NULL WHERE department_id = $1', [req.params.id]);
    await execute('DELETE FROM departments WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
