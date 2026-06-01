const attendanceService = require('./attendance.service');

async function list(req, res, next) {
  try {
    res.json(await attendanceService.getLogs(req.query));
  } catch (err) { next(err); }
}

async function today(_req, res, next) {
  try {
    res.json(await attendanceService.getTodayLogs());
  } catch (err) { next(err); }
}

async function byEmployee(req, res, next) {
  try {
    res.json(await attendanceService.getEmployeeLogs(req.params.id, req.query));
  } catch (err) { next(err); }
}

async function manual(req, res, next) {
  try {
    const { employee_id, type } = req.body;
    if (!employee_id || !type) return res.status(400).json({ error: 'employee_id and type are required' });
    if (!['clock_in', 'clock_out'].includes(type)) return res.status(400).json({ error: 'type must be clock_in or clock_out' });

    const record = await attendanceService.createManualLog(req.body);
    res.status(201).json(record);
  } catch (err) { next(err); }
}

async function deleteLog(req, res, next) {
  try {
    const result = await attendanceService.deleteLog(req.params.id);
    if (!result) return res.status(404).json({ error: 'Log not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
}

module.exports = { list, today, byEmployee, manual, deleteLog };
