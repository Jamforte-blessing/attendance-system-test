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
      ORDER BY al.timestamp DESC LIMIT 3
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

router.get('/notifications', async (_req, res, next) => {
  try {
    const lateArrivals = await query(`
      SELECT al.id, al.timestamp, e.name as employee_name
      FROM attendance_logs al
      JOIN employees e ON e.id = al.employee_id
      WHERE al.timestamp::date = CURRENT_DATE AND al.type = 'clock_in' AND al.is_late = 1
      ORDER BY al.timestamp DESC LIMIT 10
    `);

    const recentActivity = await query(`
      SELECT al.id, al.type, e.name as employee_name, al.timestamp
      FROM attendance_logs al
      JOIN employees e ON e.id = al.employee_id
      WHERE al.timestamp >= NOW() - INTERVAL '2 hours'
        AND al.timestamp::date = CURRENT_DATE
      ORDER BY al.timestamp DESC LIMIT 5
    `);

    const overdue = await query(`
      SELECT e.name as employee_name, e.shift_end
      FROM employees e
      JOIN attendance_logs al ON al.employee_id = e.id
      WHERE al.timestamp::date = CURRENT_DATE
        AND al.id = (
          SELECT id FROM attendance_logs al2
          WHERE al2.employee_id = e.id AND al2.timestamp::date = CURRENT_DATE
          ORDER BY al2.timestamp DESC LIMIT 1
        )
        AND al.type = 'clock_in'
        AND TO_CHAR(NOW(), 'HH24:MI') > e.shift_end
    `);

    const lateIds = new Set(lateArrivals.map(a => a.id));
    const items = [];

    overdue.forEach(a => items.push({
      id: `overdue-${a.employee_name}`,
      type: 'overdue',
      title: 'Still Inside',
      desc: `${a.employee_name} hasn't clocked out (shift ends ${a.shift_end})`,
      time: 'Now',
    }));

    lateArrivals.forEach(a => items.push({
      id: `late-${a.id}`,
      type: 'late',
      title: 'Late Arrival',
      desc: `${a.employee_name} clocked in late`,
      time: new Date(a.timestamp).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' }),
    }));

    recentActivity.forEach(a => {
      if (!lateIds.has(a.id)) {
        items.push({
          id: `activity-${a.id}`,
          type: a.type,
          title: a.type === 'clock_in' ? 'Clock In' : 'Clock Out',
          desc: `${a.employee_name} ${a.type === 'clock_in' ? 'clocked in' : 'clocked out'}`,
          time: new Date(a.timestamp).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' }),
        });
      }
    });

    res.json({ count: lateArrivals.length + overdue.length, items: items.slice(0, 8) });
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
