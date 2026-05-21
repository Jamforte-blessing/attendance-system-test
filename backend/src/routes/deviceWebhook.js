const router = require('express').Router();
const { queryOne, execute } = require('../database');
const { logAttendance, getNextLogType } = require('../helpers/attendance');

router.post('/push', async (req, res, next) => {
  try {
    const { device_id, user_id, record_time, io_mode } = req.body;
    if (!device_id || !user_id) {
      return res.status(400).json({ error: 'device_id and user_id are required' });
    }

    const device = await queryOne('SELECT * FROM devices WHERE device_id = $1', [device_id]);
    if (!device) {
      return res.status(404).json({
        error: `Device '${device_id}' not registered. Register it in the admin panel.`
      });
    }

    const employee = await queryOne(
      `SELECT * FROM employees WHERE employee_id = $1 AND status = 'active'`, [user_id]
    );
    if (!employee) {
      return res.status(404).json({ error: `Employee '${user_id}' not found or inactive.` });
    }

    let type;
    if (io_mode === 0 || io_mode === '0') type = 'clock_in';
    else if (io_mode === 1 || io_mode === '1') type = 'clock_out';
    else type = await getNextLogType(employee.id);

    const timestamp = record_time ? new Date(record_time).toISOString() : new Date().toISOString();

    const record = await logAttendance({
      employeeId: employee.id,
      deviceId: device.id,
      type,
      timestamp,
    });

    res.json({ success: true, record });
  } catch (err) { next(err); }
});

router.post('/heartbeat', async (req, res, next) => {
  try {
    const { device_id } = req.body;
    if (!device_id) return res.status(400).json({ error: 'device_id required' });

    await execute('UPDATE devices SET last_seen = NOW() WHERE device_id = $1', [device_id]);
    res.json({ success: true, server_time: new Date().toISOString() });
  } catch (err) { next(err); }
});

module.exports = router;
