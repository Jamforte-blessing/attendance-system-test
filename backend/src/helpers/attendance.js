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

// Check if a clock-in is late, comparing in the configured timezone
async function isLate(timestamp, shiftStart, timezone) {
  const lateThreshold = parseInt((await getSetting('late_threshold_minutes')) || '15', 10);
  const tz = timezone || (await getSetting('timezone')) || 'Africa/Lagos';
  const [sh, sm] = shiftStart.split(':').map(Number);

  const scanDate = new Date(timestamp);

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(scanDate);

  const localHour   = parseInt(parts.find(p => p.type === 'hour').value,  10);
  const localMinute = parseInt(parts.find(p => p.type === 'minute').value, 10);

  const scanMinutes      = localHour * 60 + localMinute;
  const thresholdMinutes = sh * 60 + sm + lateThreshold;

  return scanMinutes > thresholdMinutes;
}

// Check if a clock-out is early, comparing in the configured timezone
function isEarlyDeparture(timestamp, shiftEnd, timezone) {
  const [eh, em] = shiftEnd.split(':').map(Number);
  const clockOutDate = new Date(timestamp);

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(clockOutDate);

  const localHour   = parseInt(parts.find(p => p.type === 'hour').value,  10);
  const localMinute = parseInt(parts.find(p => p.type === 'minute').value, 10);

  const clockOutMinutes = localHour * 60 + localMinute;
  const shiftEndMinutes = eh * 60 + em;

  return clockOutMinutes < shiftEndMinutes;
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

  // ts is always a proper JS Date (UTC internally).
  // Pass it directly to pg — it stores it correctly as a UTC timestamp.
  const ts    = timestamp ? new Date(timestamp) : new Date();
  const late  = type === 'clock_in'  ? ((await isLate(ts, employee.shift_start, timezone)) ? 1 : 0) : 0;
  const early = type === 'clock_out' ? (isEarlyDeparture(ts, employee.shift_end, timezone) ? 1 : 0) : 0;

  const result = await execute(
    `INSERT INTO attendance_logs (employee_id, type, timestamp, is_late, is_early, is_manual, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [employeeId, type, ts, late, early, isManual ? 1 : 0, notes || null]
  );

  return {
    id: result.id,
    employeeId,
    employeeName: employee.name,
    type,
    // Return a proper UTC ISO string so every consumer (kiosk, admin) parses it correctly
    timestamp: ts.toISOString(),
    isLate:  late  === 1,
    isEarly: early === 1,
  };
}

module.exports = { logAttendance, getNextLogType, isLate, getSetting, haversine };
