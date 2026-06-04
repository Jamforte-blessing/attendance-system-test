const { query, queryOne } = require('../../shared/database');
const { getCompanyIds } = require('../../shared/utils/adminScope');

async function getAnalytics({ employee_id, department_id, date_from, date_to } = {}, user) {
  const companyIds = getCompanyIds(user);
  const todayStr = new Date().toISOString().slice(0, 10);
  const end = date_to || todayStr;
  const start = date_from || (() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  })();

  // Returns params array and extra WHERE clause for filtering the employees table
  function buildScope(base = []) {
    const p = [...base];
    const clauses = [];
    if (employee_id) { p.push(parseInt(employee_id)); clauses.push(`id = $${p.length}`); }
    if (department_id) { p.push(parseInt(department_id)); clauses.push(`department_id = $${p.length}`); }
    if (companyIds !== null) {
      if (companyIds.length === 0) {
        clauses.push('1=0');
      } else {
        p.push(companyIds);
        clauses.push(`company_id = ANY($${p.length}::int[])`);
      }
    }
    return { p, where: clauses.length ? ` AND ${clauses.join(' AND ')}` : '' };
  }

  // Count active employees in scope
  const s0 = buildScope();
  const totalRow = await queryOne(
    `SELECT COUNT(*)::int as count FROM employees WHERE status='active'${s0.where}`,
    s0.p
  );
  const totalActive = totalRow?.count || 0;

  // Trend over the date range
  const s1 = buildScope([start, end]);
  const trendRaw = await query(`
    SELECT
      gs.day::date as date,
      TO_CHAR(gs.day::date, 'Dy') as day_name,
      TO_CHAR(gs.day::date, 'MM/DD') as date_label,
      COUNT(DISTINCT CASE WHEN al.type='clock_in' THEN al.employee_id END)::int as present,
      COUNT(DISTINCT CASE WHEN al.type='clock_in' AND al.is_late=1 THEN al.employee_id END)::int as late
    FROM generate_series($1::date, $2::date, '1 day'::interval) AS gs(day)
    LEFT JOIN attendance_logs al ON al.timestamp::date = gs.day::date
      AND al.employee_id IN (SELECT id FROM employees WHERE status='active'${s1.where})
    GROUP BY gs.day
    ORDER BY gs.day
  `, s1.p);

  const weekly = trendRaw.map(row => ({
    ...row,
    on_time: Math.max(0, row.present - row.late),
    absent: Math.max(0, totalActive - row.present),
  }));

  // Snapshot stats: period totals for single employee, end-date aggregate otherwise
  let today;
  if (employee_id) {
    const s2 = buildScope([start, end]);
    const periodRow = await queryOne(`
      SELECT
        COUNT(DISTINCT al.timestamp::date)::int as days_present,
        COUNT(DISTINCT CASE WHEN al.is_late=1 THEN al.timestamp::date END)::int as days_late
      FROM attendance_logs al
      WHERE al.timestamp::date BETWEEN $1 AND $2 AND al.type = 'clock_in'
        AND al.employee_id IN (SELECT id FROM employees WHERE status='active'${s2.where})
    `, s2.p);

    const days_present = periodRow?.days_present || 0;
    const days_late = periodRow?.days_late || 0;
    const totalDays = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;

    today = {
      on_time: Math.max(0, days_present - days_late),
      late: days_late,
      absent: Math.max(0, totalDays - days_present),
      total: totalDays,
      attendance_rate: totalDays > 0 ? Math.round((days_present / totalDays) * 100) : 0,
      is_period: true,
    };
  } else {
    const s2 = buildScope([end]);
    const presentRow = await queryOne(`
      SELECT COUNT(DISTINCT al.employee_id)::int as count FROM attendance_logs al
      WHERE al.timestamp::date = $1 AND al.type = 'clock_in'
        AND al.employee_id IN (SELECT id FROM employees WHERE status='active'${s2.where})
    `, s2.p);

    const s3 = buildScope([end]);
    const lateRow = await queryOne(`
      SELECT COUNT(DISTINCT al.employee_id)::int as count FROM attendance_logs al
      WHERE al.timestamp::date = $1 AND al.type = 'clock_in' AND al.is_late = 1
        AND al.employee_id IN (SELECT id FROM employees WHERE status='active'${s3.where})
    `, s3.p);

    const endPresent = presentRow?.count || 0;
    const endLate = lateRow?.count || 0;

    today = {
      on_time: Math.max(0, endPresent - endLate),
      late: endLate,
      absent: Math.max(0, totalActive - endPresent),
      total: totalActive,
      attendance_rate: totalActive > 0 ? Math.round((endPresent / totalActive) * 100) : 0,
      is_period: false,
      date: end,
    };
  }

  // Department breakdown (end date, skipped when filtering by single employee)
  let by_department = [];
  if (!employee_id) {
    const deptParams = [end];
    let deptExtra = '';
    if (department_id) { deptParams.push(parseInt(department_id)); deptExtra = ` AND e.department_id = $${deptParams.length}`; }

    const deptRows = await query(`
      SELECT
        COALESCE(d.name, 'No Department') as department,
        COUNT(DISTINCT e.id)::int as total,
        COUNT(DISTINCT al.employee_id)::int as present
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN attendance_logs al ON al.employee_id = e.id
        AND al.timestamp::date = $1 AND al.type = 'clock_in'
      WHERE e.status = 'active'${deptExtra}
      GROUP BY d.name
      ORDER BY department
    `, deptParams);

    by_department = deptRows.map(row => ({
      ...row,
      rate: row.total > 0 ? Math.round((row.present / row.total) * 100) : 0,
    }));
  }

  // Hourly clock-in distribution over the full range
  const s4 = buildScope([start, end]);
  const hourlyRaw = await query(`
    SELECT EXTRACT(HOUR FROM al.timestamp)::int as hour, COUNT(*)::int as count
    FROM attendance_logs al
    WHERE al.timestamp::date BETWEEN $1 AND $2 AND al.type = 'clock_in'
      AND al.employee_id IN (SELECT id FROM employees WHERE status='active'${s4.where})
    GROUP BY EXTRACT(HOUR FROM al.timestamp)
    ORDER BY hour
  `, s4.p);

  const hourlyMap = Object.fromEntries(hourlyRaw.map(r => [r.hour, r.count]));
  const hourly = Array.from({ length: 15 }, (_, i) => {
    const h = i + 6;
    return { hour: `${h < 10 ? '0' : ''}${h}:00`, count: hourlyMap[h] || 0 };
  });

  return { weekly, today, by_department, hourly };
}

module.exports = { getAnalytics };
