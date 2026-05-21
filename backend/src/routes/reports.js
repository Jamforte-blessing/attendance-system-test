const router = require('express').Router();
const { query } = require('../database');

function buildDateRange(period, from, to) {
  const now = new Date();
  if (from && to) return { from, to };
  if (period === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    return { from: start.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
  }
  if (period === 'month') {
    return {
      from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
      to: now.toISOString().slice(0, 10),
    };
  }
  const today = now.toISOString().slice(0, 10);
  return { from: today, to: today };
}

router.get('/summary', async (req, res, next) => {
  try {
    const { period, from, to, department_id } = req.query;
    const range = buildDateRange(period, from, to);

    const params = [range.from, range.to];
    let deptFilter = '';
    if (department_id) { deptFilter = ` AND e.department_id = $${params.length + 1}`; params.push(department_id); }

    const rows = await query(`
      SELECT
        e.id,
        e.employee_id as emp_id,
        e.name,
        d.name as department,
        COUNT(DISTINCT al.timestamp::date)::int as days_present,
        COUNT(CASE WHEN al.type='clock_in' THEN 1 END)::int as total_clockins,
        COUNT(CASE WHEN al.type='clock_in' AND al.is_late=1 THEN 1 END)::int as late_count,
        MIN(CASE WHEN al.type='clock_in' THEN al.timestamp END) as first_clock_in,
        MAX(CASE WHEN al.type='clock_out' THEN al.timestamp END) as last_clock_out
      FROM employees e
      LEFT JOIN attendance_logs al ON al.employee_id = e.id
        AND al.timestamp::date BETWEEN $1 AND $2
      LEFT JOIN departments d ON d.id = e.department_id
      WHERE e.status = 'active' ${deptFilter}
      GROUP BY e.id, e.employee_id, e.name, d.name
      ORDER BY e.name
    `, params);

    res.json({ range, rows });
  } catch (err) { next(err); }
});

router.get('/daily', async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const logs = await query(`
      SELECT al.*, e.name as employee_name, e.employee_id as emp_id,
             d.name as department_name, dev.name as device_name
      FROM attendance_logs al
      JOIN employees e ON e.id = al.employee_id
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN devices dev ON dev.id = al.device_id
      WHERE al.timestamp::date = $1
      ORDER BY al.timestamp
    `, [date]);
    res.json({ date, logs });
  } catch (err) { next(err); }
});

router.get('/export', async (req, res, next) => {
  try {
    const { period, from, to, department_id } = req.query;
    const range = buildDateRange(period, from, to);

    const params = [range.from, range.to];
    let deptFilter = '';
    if (department_id) { deptFilter = ` AND e.department_id = $${params.length + 1}`; params.push(department_id); }

    const logs = await query(`
      SELECT
        e.employee_id as "Employee ID",
        e.name as "Name",
        d.name as "Department",
        al.type as "Type",
        al.timestamp as "Timestamp",
        CASE WHEN al.is_late=1 THEN 'Yes' ELSE 'No' END as "Late",
        CASE WHEN al.is_manual=1 THEN 'Manual' ELSE 'Device' END as "Source",
        dev.name as "Device",
        al.notes as "Notes"
      FROM attendance_logs al
      JOIN employees e ON e.id = al.employee_id
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN devices dev ON dev.id = al.device_id
      WHERE al.timestamp::date BETWEEN $1 AND $2 ${deptFilter}
      ORDER BY al.timestamp
    `, params);

    const headers = ['Employee ID', 'Name', 'Department', 'Type', 'Timestamp', 'Late', 'Source', 'Device', 'Notes'];
    const csvRows = [
      headers.join(','),
      ...logs.map(row =>
        headers.map(h => {
          const val = row[h] == null ? '' : String(row[h]);
          return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
        }).join(',')
      ),
    ];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance_${range.from}_to_${range.to}.csv"`);
    res.send(csvRows.join('\n'));
  } catch (err) { next(err); }
});

router.get('/audit', async (_req, res, next) => {
  try {
    const logs = await query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200');
    res.json(logs);
  } catch (err) { next(err); }
});

module.exports = router;
