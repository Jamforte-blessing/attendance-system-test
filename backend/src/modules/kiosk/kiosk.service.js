const { query, queryOne, execute } = require('../../shared/database');
const { logAttendance, getNextLogType, haversine } = require('../../shared/utils/attendance');
const { uploadBuffer } = require('../../shared/utils/cloudinary');

async function getCompanies() {
  return query('SELECT id, name, logo_url FROM companies ORDER BY name');
}

async function getDepartments({ company_id }) {
  let sql = 'SELECT id, name FROM departments WHERE 1=1';
  const params = [];
  if (company_id) { sql += ` AND company_id = $${params.length + 1}`; params.push(company_id); }
  sql += ' ORDER BY name';
  return query(sql, params);
}

async function getUnits({ department_id }) {
  let sql = 'SELECT id, name FROM units WHERE 1=1';
  const params = [];
  if (department_id) { sql += ` AND department_id = $${params.length + 1}`; params.push(department_id); }
  sql += ' ORDER BY name';
  return query(sql, params);
}

async function getEmployees({ company_id, department_id, unit_id }) {
  let sql = `
    SELECT e.id, e.name, e.employee_id, d.name as department_name, u.name as unit_name
    FROM employees e
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN units u ON u.id = e.unit_id
    WHERE e.status = 'active'
  `;
  const params = [];
  if (company_id)    { sql += ` AND e.company_id = $${params.length + 1}`;    params.push(company_id); }
  if (department_id) { sql += ` AND e.department_id = $${params.length + 1}`; params.push(department_id); }
  if (unit_id)       { sql += ` AND e.unit_id = $${params.length + 1}`;       params.push(unit_id); }
  sql += ' ORDER BY e.name';
  return query(sql, params);
}

async function getStatus(employeeId) {
  const employee = await queryOne(
    `SELECT id, name FROM employees WHERE id = $1 AND status = 'active'`,
    [employeeId]
  );
  if (!employee) return null;

  const nextAction = await getNextLogType(employeeId);
  const lastLog = await queryOne(
    `SELECT type, timestamp FROM attendance_logs
     WHERE employee_id = $1 AND timestamp::date = CURRENT_DATE
     ORDER BY timestamp DESC LIMIT 1`,
    [employeeId]
  );

  return { employeeName: employee.name, nextAction, lastLog: lastLog || null };
}

async function getInsights(employeeId, period = 'today', start, end) {
  const employee = await queryOne(
    `SELECT id, name FROM employees WHERE id = $1 AND status = 'active'`,
    [employeeId]
  );
  if (!employee) return null;

  const params = [employeeId];
  let rangeSql;
  let rangeEnd;

  if (period === 'month') {
    rangeSql = `date_trunc('month', CURRENT_DATE)::date`;
    rangeEnd = `CURRENT_DATE`;
  } else if (period === 'week') {
    rangeSql = `date_trunc('week', CURRENT_DATE)::date`;
    rangeEnd = `CURRENT_DATE`;
  } else if (period === 'custom') {
    if (!start || !end) {
      throw new Error('Custom range requires start and end dates');
    }
    params.push(start, end);
    rangeSql = `$2::date`;
    rangeEnd = `$3::date`;
  } else {
    rangeSql = `CURRENT_DATE`;
    rangeEnd = `CURRENT_DATE`;
  }

  const summary = await queryOne(`
    WITH day_logs AS (
      SELECT
        timestamp::date as log_date,
        MIN(timestamp) FILTER (WHERE type = 'clock_in') as clock_in,
        MAX(timestamp) FILTER (WHERE type = 'clock_out') as clock_out,
        BOOL_OR(type = 'clock_in' AND is_late = 1) as was_late
      FROM attendance_logs
      WHERE employee_id = $1
        AND timestamp::date >= ${rangeSql}
        AND timestamp::date <= ${rangeEnd}
      GROUP BY timestamp::date
    ),
    record_count AS (
      SELECT COUNT(*)::int as records
      FROM attendance_logs
      WHERE employee_id = $1
        AND timestamp::date >= ${rangeSql}
        AND timestamp::date <= ${rangeEnd}
    )
    SELECT
      COUNT(clock_in)::int as days_present,
      COUNT(*) FILTER (WHERE clock_in IS NOT NULL AND was_late)::int as late,
      COUNT(*) FILTER (WHERE clock_in IS NOT NULL AND NOT was_late)::int as on_time,
      COALESCE(SUM(
        CASE
          WHEN clock_in IS NOT NULL AND clock_out IS NOT NULL
          THEN EXTRACT(EPOCH FROM (clock_out - clock_in)) / 60
          ELSE 0
        END
      ), 0)::int as total_minutes,
      (SELECT records FROM record_count)::int as records
    FROM day_logs
  `, params);

  return {
    employeeName: employee.name,
    period,
    daysPresent: summary?.days_present || 0,
    late: summary?.late || 0,
    onTime: summary?.on_time || 0,
    totalMinutes: summary?.total_minutes || 0,
    records: summary?.records || 0,
  };
}

async function scan({ employee_id, latitude, longitude, photo }) {
  const employee = await queryOne(`
    SELECT e.*, c.latitude as co_lat, c.longitude as co_lng,
           c.radius_meters, c.name as company_name
    FROM employees e
    LEFT JOIN companies c ON c.id = e.company_id
    WHERE e.id = $1 AND e.status = 'active'
  `, [employee_id]);

  if (!employee) return { error: 'Employee not found', status: 404 };

  const type = await getNextLogType(employee_id);
  if (type === 'done') {
    return { error: 'You have already clocked in and out today.', status: 409 };
  }

  if (employee.co_lat != null && employee.co_lng != null) {
    if (latitude == null || longitude == null) {
      return { error: 'Location access is required to clock in at this workplace.', status: 400 };
    }

    const dist = Math.round(haversine(
      parseFloat(latitude), parseFloat(longitude),
      parseFloat(employee.co_lat), parseFloat(employee.co_lng)
    ));

    // Add 10m tolerance for GPS drift (typical consumer GPS accuracy is ±5-15m)
    const allowedDistance = employee.radius_meters + 10;

    if (dist > allowedDistance) {
      return {
        error: `You are ${dist}m away from the workplace. You must be within ${employee.radius_meters}m to clock in.`,
        status: 403,
      };
    }
  }

  const record = await logAttendance({
    employeeId: employee_id,
    type,
    notes: 'Kiosk self-service',
  });

  let photoUrl = null;
  if (photo) {
    try {
      const base64Data = photo.replace(/^data:image\/[a-z]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const result = await uploadBuffer(buffer, {
        folder: `attendance-photos/${employee.employee_id}`,
        public_id: `${type}-${Date.now()}`,
        resource_type: 'image',
        overwrite: false,
      });
      photoUrl = result.secure_url;
      await execute('UPDATE attendance_logs SET photo_url = $1 WHERE id = $2', [photoUrl, record.id]);
    } catch (err) {
      console.error('Photo upload failed:', err.message);
    }
  }

  return {
    success: true,
    type,
    employeeName: employee.name,
    timestamp: record.timestamp,
    isLate: record.isLate,
    photo_url: photoUrl,
  };
}

module.exports = { getCompanies, getDepartments, getUnits, getEmployees, getStatus, getInsights, scan };
