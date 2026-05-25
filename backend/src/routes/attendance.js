const router = require('express').Router();
const { query, queryOne, execute } = require('../database');
const { logAttendance } = require('../helpers/attendance');

router.get('/', async (req, res, next) => {
  try {
    const { employee_id, date, from, to, department_id, type } = req.query;
    let sql = `
      SELECT al.*, e.name as employee_name, e.employee_id as emp_id,
             d.name as department_name
      FROM attendance_logs al
      JOIN employees e ON e.id = al.employee_id
      LEFT JOIN departments d ON d.id = e.department_id
      WHERE 1=1
    `;
    const params = [];

    if (employee_id)   { sql += ` AND al.employee_id = $${params.length + 1}`;          params.push(employee_id); }
    if (type)          { sql += ` AND al.type = $${params.length + 1}`;                  params.push(type); }
    if (department_id) { sql += ` AND e.department_id = $${params.length + 1}`;          params.push(department_id); }
    if (date)          { sql += ` AND al.timestamp::date = $${params.length + 1}`;       params.push(date); }
    if (from)          { sql += ` AND al.timestamp::date >= $${params.length + 1}`;      params.push(from); }
    if (to)            { sql += ` AND al.timestamp::date <= $${params.length + 1}`;      params.push(to); }

    const limit = Math.min(parseInt(req.query.limit) || 200, 500);
    sql += ` ORDER BY al.timestamp DESC LIMIT ${limit}`;

    res.json(await query(sql, params));
  } catch (err) { next(err); }
});

router.get('/today', async (_req, res, next) => {
  try {
    const logs = await query(`
      SELECT al.*, e.name as employee_name, e.employee_id as emp_id, d.name as department_name
      FROM attendance_logs al
      JOIN employees e ON e.id = al.employee_id
      LEFT JOIN departments d ON d.id = e.department_id
      WHERE al.timestamp::date = CURRENT_DATE
      ORDER BY al.timestamp DESC
    `);
    res.json(logs);
  } catch (err) { next(err); }
});

router.get('/employee/:id', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    let sql = `
      SELECT al.*
      FROM attendance_logs al
      WHERE al.employee_id = $1
    `;
    const params = [req.params.id];
    if (from) { sql += ` AND al.timestamp::date >= $${params.length + 1}`; params.push(from); }
    if (to)   { sql += ` AND al.timestamp::date <= $${params.length + 1}`; params.push(to); }
    sql += ' ORDER BY al.timestamp DESC LIMIT 100';

    res.json(await query(sql, params));
  } catch (err) { next(err); }
});

router.post('/manual', async (req, res, next) => {
  try {
    const { employee_id, type, timestamp, notes } = req.body;
    if (!employee_id || !type) return res.status(400).json({ error: 'employee_id and type are required' });
    if (!['clock_in', 'clock_out'].includes(type)) return res.status(400).json({ error: 'type must be clock_in or clock_out' });

    const record = await logAttendance({ employeeId: employee_id, type, timestamp, isManual: true, notes });
    await execute('INSERT INTO audit_logs (action, entity, entity_id, details) VALUES ($1, $2, $3, $4)',
      ['MANUAL_LOG', 'attendance', record.id, JSON.stringify({ employee_id, type, timestamp })]);
    res.status(201).json(record);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const log = await queryOne('SELECT id FROM attendance_logs WHERE id = $1', [req.params.id]);
    if (!log) return res.status(404).json({ error: 'Log not found' });

    await execute('DELETE FROM attendance_logs WHERE id = $1', [req.params.id]);
    await execute('INSERT INTO audit_logs (action, entity, entity_id, details) VALUES ($1, $2, $3, $4)',
      ['DELETE', 'attendance', req.params.id, null]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
