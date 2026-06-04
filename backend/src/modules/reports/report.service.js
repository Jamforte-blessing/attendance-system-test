const { query } = require('../../shared/database');
const { addCompanyScope } = require('../../shared/utils/adminScope');

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

async function getSummary({ period, from, to, department_id }, user) {
  const range = buildDateRange(period, from, to);
  const params = [range.from, range.to];
  let deptFilter = '';
  if (department_id) { deptFilter = ` AND e.department_id = $${params.length + 1}`; params.push(department_id); }

  let sql = `
    SELECT
      e.id,
      e.employee_id as emp_id,
      e.name,
      d.name as department,
      COUNT(DISTINCT al.timestamp::date)::int as days_present,
      COUNT(CASE WHEN al.type='clock_in' THEN 1 END)::int as total_clockins,
      COUNT(CASE WHEN al.type='clock_in' AND al.is_late=1 THEN 1 END)::int as late_count,
      COUNT(CASE WHEN al.type='clock_out' AND al.is_early=1 THEN 1 END)::int as early_count,
      MIN(CASE WHEN al.type='clock_in' THEN al.timestamp END) as first_clock_in,
      MAX(CASE WHEN al.type='clock_out' THEN al.timestamp END) as last_clock_out
    FROM employees e
    LEFT JOIN attendance_logs al ON al.employee_id = e.id
      AND al.timestamp::date BETWEEN $1 AND $2
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE e.status = 'active'${deptFilter}`;

  const scoped = addCompanyScope({ sql, params, column: 'e.company_id', user });
  const rows = await query(
    scoped.sql + ' GROUP BY e.id, e.employee_id, e.name, d.name ORDER BY e.name',
    scoped.params
  );

  return { range, rows };
}

async function getDaily(date, user) {
  let sql = `
    SELECT al.*, e.name as employee_name, e.employee_id as emp_id,
           d.name as department_name
    FROM attendance_logs al
    JOIN employees e ON e.id = al.employee_id
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE al.timestamp::date = $1`;
  const params = [date];

  const scoped = addCompanyScope({ sql, params, column: 'e.company_id', user });
  const logs = await query(scoped.sql + ' ORDER BY al.timestamp', scoped.params);
  return { date, logs };
}

async function getExportData({ period, from, to, department_id }, user) {
  const range = buildDateRange(period, from, to);
  const params = [range.from, range.to];
  let deptFilter = '';
  if (department_id) { deptFilter = ` AND e.department_id = $${params.length + 1}`; params.push(department_id); }

  let sql = `
    SELECT
      e.employee_id as "Employee ID",
      e.name as "Name",
      d.name as "Department",
      al.type as "Type",
      al.timestamp as "Timestamp",
      CASE WHEN al.is_late=1 THEN 'Yes' ELSE 'No' END as "Late",
      CASE WHEN al.is_manual=1 THEN 'Manual' ELSE 'Kiosk' END as "Source",
      al.notes as "Notes"
    FROM attendance_logs al
    JOIN employees e ON e.id = al.employee_id
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE al.timestamp::date BETWEEN $1 AND $2${deptFilter}`;

  const scoped = addCompanyScope({ sql, params, column: 'e.company_id', user });
  const logs = await query(scoped.sql + ' ORDER BY al.timestamp', scoped.params);
  return { range, logs };
}

async function getAuditLogs() {
  return query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200');
}

module.exports = { getSummary, getDaily, getExportData, getAuditLogs };
