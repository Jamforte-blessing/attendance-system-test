const { query, queryOne, execute } = require('../database');

async function getSetting(key) {
  const row = await queryOne('SELECT value FROM settings WHERE "key" = $1', [key]);
  return row ? row.value : null;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function isLate(timestamp, shiftStart) {
  const lateThreshold = parseInt((await getSetting('late_threshold_minutes')) || '15', 10);
  const [sh, sm] = shiftStart.split(':').map(Number);

  const scanTime = new Date(timestamp);
  const thresholdTime = new Date(scanTime);
  thresholdTime.setHours(sh, sm + lateThreshold, 0, 0);

  return scanTime > thresholdTime;
}

async function getNextLogType(employeeId) {
  const last = await queryOne(
    `SELECT type FROM attendance_logs
     WHERE employee_id = $1 AND timestamp::date = CURRENT_DATE
     ORDER BY timestamp DESC LIMIT 1`,
    [employeeId]
  );
  if (!last || last.type === 'clock_out') return 'clock_in';
  return 'clock_out';
}

function formatLocalTimestamp(date) {
  const pad = value => String(value).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

async function logAttendance({ employeeId, type, timestamp, isManual, notes }) {
  const employee = await queryOne('SELECT * FROM employees WHERE id = $1', [employeeId]);
  if (!employee) throw new Error('Employee not found');

  const ts = timestamp ? new Date(timestamp) : new Date();
  const tsStr = formatLocalTimestamp(ts);
  const late = type === 'clock_in' ? ((await isLate(ts, employee.shift_start)) ? 1 : 0) : 0;

  const result = await execute(
    `INSERT INTO attendance_logs (employee_id, type, timestamp, is_late, is_manual, notes)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [employeeId, type, tsStr, late, isManual ? 1 : 0, notes || null]
  );

  return {
    id: result.id,
    employeeId,
    employeeName: employee.name,
    type,
    timestamp: tsStr,
    isLate: late === 1,
  };
}

module.exports = { logAttendance, getNextLogType, isLate, getSetting, haversine };
