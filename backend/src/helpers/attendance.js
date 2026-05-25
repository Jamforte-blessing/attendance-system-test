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

// Format a Date into "YYYY-MM-DD HH:mm:ss" in the given IANA timezone
// (avoids using server local time, which may be UTC on hosted servers)
function formatInTimezone(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = type => parts.find(p => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

async function isLate(timestamp, shiftStart, timezone) {
  const lateThreshold = parseInt((await getSetting('late_threshold_minutes')) || '15', 10);
  const tz = timezone || (await getSetting('timezone')) || 'Africa/Lagos';
  const [sh, sm] = shiftStart.split(':').map(Number);

  const scanDate = new Date(timestamp);

  // Get clock-in hour/minute in the configured timezone, NOT server local time
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(scanDate);

  const localHour   = parseInt(parts.find(p => p.type === 'hour').value,   10);
  const localMinute = parseInt(parts.find(p => p.type === 'minute').value,  10);

  const scanMinutes      = localHour * 60 + localMinute;
  const thresholdMinutes = sh * 60 + sm + lateThreshold;

  return scanMinutes > thresholdMinutes;
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

async function logAttendance({ employeeId, type, timestamp, isManual, notes }) {
  const employee = await queryOne('SELECT * FROM employees WHERE id = $1', [employeeId]);
  if (!employee) throw new Error('Employee not found');

  const timezone = (await getSetting('timezone')) || 'Africa/Lagos';
  const ts    = timestamp ? new Date(timestamp) : new Date();
  const tsStr = formatInTimezone(ts, timezone);
  const late  = type === 'clock_in' ? ((await isLate(ts, employee.shift_start, timezone)) ? 1 : 0) : 0;

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
