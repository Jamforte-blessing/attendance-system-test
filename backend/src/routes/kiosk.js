const router = require('express').Router();
const { query, queryOne } = require('../database');
const { logAttendance, getNextLogType, haversine } = require('../helpers/attendance');
const { sendMail, clockInEmail, clockOutEmail } = require('../helpers/mailer');

router.get('/companies', async (req, res, next) => {
  try {
    const companies = await query('SELECT id, name FROM companies ORDER BY name');
    res.json(companies);
  } catch (err) { next(err); }
});

router.get('/departments', async (req, res, next) => {
  try {
    const { company_id } = req.query;
    let sql = 'SELECT id, name FROM departments WHERE 1=1';
    const params = [];
    if (company_id) { sql += ` AND company_id = $${params.length + 1}`; params.push(company_id); }
    sql += ' ORDER BY name';
    res.json(await query(sql, params));
  } catch (err) { next(err); }
});

router.get('/employees', async (req, res, next) => {
  try {
    const { company_id, department_id } = req.query;
    let sql = `
      SELECT e.id, e.name, e.employee_id, d.name as department_name
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      WHERE e.status = 'active'
    `;
    const params = [];
    if (company_id)    { sql += ` AND e.company_id = $${params.length + 1}`;    params.push(company_id); }
    if (department_id) { sql += ` AND e.department_id = $${params.length + 1}`; params.push(department_id); }
    sql += ' ORDER BY e.name';
    res.json(await query(sql, params));
  } catch (err) { next(err); }
});

router.get('/status/:employeeId', async (req, res, next) => {
  try {
    const employee = await queryOne(
      `SELECT id, name FROM employees WHERE id = $1 AND status = 'active'`,
      [req.params.employeeId]
    );
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const nextAction = await getNextLogType(req.params.employeeId);
    const lastLog = await queryOne(
      `SELECT type, timestamp FROM attendance_logs
       WHERE employee_id = $1 AND timestamp::date = CURRENT_DATE
       ORDER BY timestamp DESC LIMIT 1`,
      [req.params.employeeId]
    );

    res.json({ employeeName: employee.name, nextAction, lastLog: lastLog || null });
  } catch (err) { next(err); }
});

router.post('/scan', async (req, res, next) => {
  try {
    const { employee_id, latitude, longitude } = req.body;
    if (!employee_id) return res.status(400).json({ error: 'employee_id is required' });

    const employee = await queryOne(`
      SELECT e.*, c.latitude as co_lat, c.longitude as co_lng,
             c.radius_meters, c.name as company_name
      FROM employees e
      LEFT JOIN companies c ON c.id = e.company_id
      WHERE e.id = $1 AND e.status = 'active'
    `, [employee_id]);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    if (employee.co_lat != null && employee.co_lng != null) {
      if (latitude == null || longitude == null) {
        return res.status(400).json({ error: 'Location access is required to clock in at this workplace.' });
      }

      const dist = Math.round(haversine(
        parseFloat(latitude), parseFloat(longitude),
        parseFloat(employee.co_lat), parseFloat(employee.co_lng)
      ));

      if (dist > employee.radius_meters) {
        return res.status(403).json({
          error: `You are ${dist}m away from the workplace. You must be within ${employee.radius_meters}m to clock in.`,
        });
      }
    }

    const type = await getNextLogType(employee_id);
    if (type === 'done') {
      return res.status(409).json({ error: 'You have already clocked in and out today.' });
    }
    const record = await logAttendance({
      employeeId: employee_id,
      type,
      notes: 'Kiosk self-service',
    });

    res.json({
      success: true,
      type,
      employeeName: employee.name,
      timestamp: record.timestamp,
      isLate: record.isLate,
    });

    if (employee.email) {
      const emailData = type === 'clock_in'
        ? clockInEmail({ employeeName: employee.name, timestamp: record.timestamp, isLate: record.isLate })
        : clockOutEmail({ employeeName: employee.name, timestamp: record.timestamp, isEarly: record.isEarly });
      sendMail({ to: employee.email, ...emailData });
    }
  } catch (err) { next(err); }
});

module.exports = router;
