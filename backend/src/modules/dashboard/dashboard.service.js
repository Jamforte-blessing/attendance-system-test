const { query, queryOne } = require('../../shared/database');
const { getCompanyIds } = require('../../shared/utils/adminScope');

// Returns SQL snippet and params for filtering employees by company.
// empAlias is the alias for the employees table in the query.
function buildCompanyFilter(companyIds, empAlias = '') {
  const col = empAlias ? `${empAlias}.company_id` : 'company_id';
  if (companyIds === null) return { where: '', params: [] };
  if (companyIds.length === 0) return { where: ' AND 1=0', params: [] };
  return { where: ` AND ${col} = ANY($1::int[])`, params: [companyIds] };
}

async function getStats(user) {
  const companyIds = getCompanyIds(user);
  const { where: empWhere, params: empParams } = buildCompanyFilter(companyIds);
  const { where: empJoinWhere, params: empJoinParams } = buildCompanyFilter(companyIds, 'e');

  const totalActive = parseInt((await queryOne(
    `SELECT COUNT(*)::int as count FROM employees WHERE status='active'${empWhere}`,
    empParams
  )).count);

  const clockedInToday = parseInt((await queryOne(`
    SELECT COUNT(DISTINCT employee_id)::int as count FROM attendance_logs
    WHERE timestamp::date = CURRENT_DATE AND type = 'clock_in'
      AND employee_id IN (SELECT id FROM employees WHERE status='active'${empWhere})
  `, empParams)).count);

  const currentlyIn = parseInt((await queryOne(`
    SELECT COUNT(*)::int as count FROM (
      SELECT al.employee_id
      FROM attendance_logs al
      JOIN employees e ON e.id = al.employee_id
      WHERE al.timestamp::date = CURRENT_DATE
        AND al.id = (
          SELECT id FROM attendance_logs al2
          WHERE al2.employee_id = al.employee_id AND al2.timestamp::date = CURRENT_DATE
          ORDER BY al2.timestamp DESC LIMIT 1
        )
        AND al.type = 'clock_in'${empJoinWhere}
      GROUP BY al.employee_id
    ) AS inside
  `, empJoinParams)).count);

  const lateToday = parseInt((await queryOne(`
    SELECT COUNT(DISTINCT employee_id)::int as count FROM attendance_logs
    WHERE timestamp::date = CURRENT_DATE AND type = 'clock_in' AND is_late = 1
      AND employee_id IN (SELECT id FROM employees WHERE status='active'${empWhere})
  `, empParams)).count);

  const onLeave = parseInt((await queryOne(`
    SELECT COUNT(*)::int as count FROM leaves WHERE date = CURRENT_DATE AND status = 'approved'
  `)).count);

  const absent = parseInt((await queryOne(`
    SELECT COUNT(*)::int as count
    FROM employees e
    WHERE e.status = 'active'
      AND TO_CHAR(CURRENT_DATE, 'Dy') = ANY(string_to_array(COALESCE(e.work_days, 'Mon,Tue,Wed,Thu,Fri'), ','))
      AND e.id NOT IN (
        SELECT DISTINCT al.employee_id FROM attendance_logs al
        WHERE al.timestamp::date = CURRENT_DATE AND al.type = 'clock_in'
      )
      AND e.id NOT IN (
        SELECT l.employee_id FROM leaves l
        WHERE l.date = CURRENT_DATE AND l.status = 'approved'
      )${empJoinWhere}
  `, empJoinParams)).count);

  const recentActivity = await query(`
    SELECT al.*, e.name as employee_name, e.employee_id as emp_id
    FROM attendance_logs al
    JOIN employees e ON e.id = al.employee_id
    WHERE 1=1${empJoinWhere}
    ORDER BY al.timestamp DESC LIMIT 3
  `, empJoinParams);

  const weeklyData = await query(`
    SELECT al.timestamp::date as date,
           COUNT(CASE WHEN al.type='clock_in' THEN 1 END)::int as clock_ins,
           COUNT(CASE WHEN al.type='clock_in' AND al.is_late=1 THEN 1 END)::int as late_count
    FROM attendance_logs al
    JOIN employees e ON e.id = al.employee_id
    WHERE al.timestamp::date >= CURRENT_DATE - INTERVAL '6 days'${empJoinWhere}
    GROUP BY al.timestamp::date
    ORDER BY al.timestamp::date
  `, empJoinParams);

  return { totalActive, clockedInToday, currentlyIn, lateToday, absent, onLeave, recentActivity, weeklyData };
}

async function getNotifications(user) {
  const companyIds = getCompanyIds(user);
  const { where: empJoinWhere, params: empJoinParams } = buildCompanyFilter(companyIds, 'e');

  const lateArrivals = await query(`
    SELECT al.id, al.timestamp, e.name as employee_name
    FROM attendance_logs al
    JOIN employees e ON e.id = al.employee_id
    WHERE al.timestamp::date = CURRENT_DATE AND al.type = 'clock_in' AND al.is_late = 1${empJoinWhere}
    ORDER BY al.timestamp DESC LIMIT 10
  `, empJoinParams);

  const recentActivity = await query(`
    SELECT al.id, al.type, e.name as employee_name, al.timestamp
    FROM attendance_logs al
    JOIN employees e ON e.id = al.employee_id
    WHERE al.timestamp >= NOW() - INTERVAL '2 hours'
      AND al.timestamp::date = CURRENT_DATE${empJoinWhere}
    ORDER BY al.timestamp DESC LIMIT 5
  `, empJoinParams);

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
      AND TO_CHAR(NOW(), 'HH24:MI') > e.shift_end${empJoinWhere}
  `, empJoinParams);

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

  return { count: lateArrivals.length + overdue.length, items: items.slice(0, 8) };
}

async function getLive(user) {
  const companyIds = getCompanyIds(user);
  const { where: empWhere, params: empParams } = buildCompanyFilter(companyIds, 'e');

  return query(`
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
      )${empWhere}
    ORDER BY al.timestamp DESC
  `, empParams);
}

module.exports = { getStats, getNotifications, getLive };
