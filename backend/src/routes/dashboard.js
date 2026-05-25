const router = require('express').Router();
const { query, queryOne } = require('../database');

router.get('/stats', async (_req, res, next) => {
  try {
    const totalActive = parseInt((await queryOne(`SELECT COUNT(*)::int as count FROM employees WHERE status='active'`)).count);

    const clockedInToday = parseInt((await queryOne(`
      SELECT COUNT(DISTINCT employee_id)::int as count FROM attendance_logs
      WHERE timestamp::date = CURRENT_DATE AND type = 'clock_in'
    `)).count);

    const currentlyIn = parseInt((await queryOne(`
      SELECT COUNT(*)::int as count FROM (
        SELECT al.employee_id
        FROM attendance_logs al
        WHERE al.timestamp::date = CURRENT_DATE
          AND al.id = (
            SELECT id FROM attendance_logs al2
            WHERE al2.employee_id = al.employee_id AND al2.timestamp::date = CURRENT_DATE
            ORDER BY al2.timestamp DESC LIMIT 1
          )
          AND al.type = 'clock_in'
        GROUP BY al.employee_id
      ) AS inside
    `)).count);

    const lateToday = parseInt((await queryOne(`
      SELECT COUNT(DISTINCT employee_id)::int as count FROM attendance_logs
      WHERE timestamp::date = CURRENT_DATE AND type = 'clock_in' AND is_late = 1
    `)).count);

    const onLeave = parseInt((await queryOne(`
      SELECT COUNT(*)::int as count FROM leaves WHERE date = CURRENT_DATE AND status = 'approved'
    `)).count);

    const absent = Math.max(0, totalActive - clockedInToday - onLeave);

    const recentActivity = await query(`
      SELECT al.*, e.name as employee_name, e.employee_id as emp_id
      FROM attendance_logs al
      JOIN employees e ON e.id = al.employee_id
      ORDER BY al.timestamp DESC LIMIT 10
    `);

    const weeklyData = await query(`
      SELECT timestamp::date as date,
             COUNT(CASE WHEN type='clock_in' THEN 1 END)::int as clock_ins,
             COUNT(CASE WHEN type='clock_in' AND is_late=1 THEN 1 END)::int as late_count
      FROM attendance_logs
      WHERE timestamp::date >= CURRENT_DATE - INTERVAL '6 days'
      GROUP BY timestamp::date
      ORDER BY timestamp::date
    `);

    res.json({ totalActive, clockedInToday, currentlyIn, lateToday, absent, onLeave, recentActivity, weeklyData });
  } catch (err) { next(err); }
});

router.get('/live', async (_req, res, next) => {
  try {
    const live = await query(`
      SELECT e.id, e.employee_id as emp_id, e.name, d.name as department,
             al.timestamp as clocked_in_at
      FROM employees e
      JOIN attendance_logs al ON al.employee_id = e.id
      LEFT JOIN departments d ON d.id = e.department_id
      WHERE al.timestamp::date = CURRENT_DATE
        AND al.type = 'clock_in'
        AND al.id = (
          SELECT id FROM attendance_logs al2
          WHERE al2.employee_id = e.id AND al2.timestamp::date = CURRENT_DATE
          ORDER BY al2.timestamp DESC LIMIT 1
        )
      ORDER BY al.timestamp DESC
    `);
    res.json(live);
  } catch (err) { next(err); }
});

module.exports = router;
