const router = require('express').Router();
const { query, queryOne, execute } = require('../database');

router.get('/', async (req, res, next) => {
  try {
    const { department_id, company_id, status, search } = req.query;
    let sql = `
      SELECT e.*, d.name as department_name, c.name as company_name
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN companies c ON c.id = e.company_id
      WHERE 1=1
    `;
    const params = [];

    if (company_id)    { sql += ` AND e.company_id = $${params.length + 1}`;                                              params.push(company_id); }
    if (department_id) { sql += ` AND e.department_id = $${params.length + 1}`;                                           params.push(department_id); }
    if (status)        { sql += ` AND e.status = $${params.length + 1}`;                                                   params.push(status); }
    if (search)        { sql += ` AND (e.name ILIKE $${params.length + 1} OR e.employee_id ILIKE $${params.length + 2})`; params.push(`%${search}%`, `%${search}%`); }
    sql += ' ORDER BY e.name';

    res.json(await query(sql, params));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const employee = await queryOne(`
      SELECT e.*, d.name as department_name, c.name as company_name
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN companies c ON c.id = e.company_id
      WHERE e.id = $1
    `, [req.params.id]);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    res.json(employee);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { employee_id, name, email, phone, company_id, department_id, shift_start, shift_end } = req.body;
    if (!employee_id || !name) return res.status(400).json({ error: 'employee_id and name are required' });

    const result = await execute(
      `INSERT INTO employees (employee_id, name, email, phone, company_id, department_id, shift_start, shift_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [employee_id, name, email || null, phone || null,
       company_id || null, department_id || null,
       shift_start || '09:00', shift_end || '17:00']
    );
    await execute(
      'INSERT INTO audit_logs (action, entity, entity_id, details) VALUES ($1, $2, $3, $4)',
      ['CREATE', 'employee', result.id, JSON.stringify({ employee_id, name })]
    );
    res.status(201).json({ id: result.id, employee_id, name });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Employee ID already exists' });
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, email, phone, company_id, department_id, shift_start, shift_end, status } = req.body;
    const emp = await queryOne('SELECT id FROM employees WHERE id = $1', [req.params.id]);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    await execute(
      `UPDATE employees
       SET name=$1, email=$2, phone=$3, company_id=$4, department_id=$5,
           shift_start=$6, shift_end=$7, status=$8, updated_at=NOW()
       WHERE id=$9`,
      [name, email || null, phone || null,
       company_id || null, department_id || null,
       shift_start || '09:00', shift_end || '17:00',
       status || 'active', req.params.id]
    );
    await execute(
      'INSERT INTO audit_logs (action, entity, entity_id, details) VALUES ($1, $2, $3, $4)',
      ['UPDATE', 'employee', req.params.id, JSON.stringify(req.body)]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await execute(`UPDATE employees SET status='inactive', updated_at=NOW() WHERE id=$1`, [req.params.id]);
    await execute(
      'INSERT INTO audit_logs (action, entity, entity_id, details) VALUES ($1, $2, $3, $4)',
      ['DEACTIVATE', 'employee', req.params.id, null]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
