const router = require('express').Router();
const { query, queryOne } = require('../database');

router.get('/', async (_req, res, next) => {
  try {
    const { count: totalActive } = await queryOne(
      `SELECT COUNT(*)::int as count FROM employees WHERE status='active'`
    );

    // Last 7 days trend
    const weekly = await query(`
      SELECT
        gs.day::date as date,
        TO_CHAR(gs.day::date, 'Dy') as day_name,
        COUNT(DISTINCT CASE WHEN al.type='clock_in' THEN al.employee_id END)::int as present,
        COUNT(DISTINCT CASE WHEN al.type='clock_in' AND al.is_late=1 THEN al.employee_id END)::int as late
      FROM generate_series(
        CURRENT_DATE - INTERVAL '6 days',
        CURRENT_DATE,
        '1 day'::interval
      ) AS gs(day)
      LEFT JOIN attendance_logs al ON al.timestamp::date = gs.day::date
      GROUP BY gs.day
      ORDER BY gs.day
    `);

    const weeklyWithCalc = weekly.map(row => ({
      ...row,
      on_time: Math.max(0, row.present - row.late),
      absent: Math.max(0, totalActive - row.present),
    }));

    // Today breakdown
    const todayPresent = parseInt((await queryOne(`
      SELECT COUNT(DISTINCT employee_id)::int as count FROM attendance_logs
      WHERE timestamp::date = CURRENT_DATE AND type = 'clock_in'
    `)).count);

    const todayLate = parseInt((await queryOne(`
      SELECT COUNT(DISTINCT employee_id)::int as count FROM attendance_logs
      WHERE timestamp::date = CURRENT_DATE AND type = 'clock_in' AND is_late = 1
    `)).count);

    const today = {
      on_time: Math.max(0, todayPresent - todayLate),
      late: todayLate,
      absent: Math.max(0, totalActive - todayPresent),
      total: totalActive,
      attendance_rate: totalActive > 0 ? Math.round((todayPresent / totalActive) * 100) : 0,
    };

    // Department breakdown
    const byDepartment = await query(`
      SELECT
        COALESCE(d.name, 'No Department') as department,
        COUNT(DISTINCT e.id)::int as total,
        COUNT(DISTINCT al.employee_id)::int as present
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN attendance_logs al ON al.employee_id = e.id
        AND al.timestamp::date = CURRENT_DATE AND al.type = 'clock_in'
      WHERE e.status = 'active'
      GROUP BY d.name
      ORDER BY department
    `);

    const byDepartmentWithRate = byDepartment.map(row => ({
      ...row,
      rate: row.total > 0 ? Math.round((row.present / row.total) * 100) : 0,
    }));

    // Hourly clock-ins today
    const hourlyRaw = await query(`
      SELECT EXTRACT(HOUR FROM timestamp)::int as hour, COUNT(*)::int as count
      FROM attendance_logs
      WHERE timestamp::date = CURRENT_DATE AND type = 'clock_in'
      GROUP BY EXTRACT(HOUR FROM timestamp)
      ORDER BY hour
    `);

    // Fill in all hours 6–20 so chart always shows a full range
    const hourlyMap = Object.fromEntries(hourlyRaw.map(r => [r.hour, r.count]));
    const hourly = Array.from({ length: 15 }, (_, i) => {
      const h = i + 6;
      return { hour: `${h < 10 ? '0' : ''}${h}:00`, count: hourlyMap[h] || 0 };
    });

    res.json({ weekly: weeklyWithCalc, today, by_department: byDepartmentWithRate, hourly });
  } catch (err) { next(err); }
});

module.exports = router;
