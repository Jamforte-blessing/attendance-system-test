const kioskService = require('./kiosk.service');

async function companies(_req, res, next) {
  try {
    res.json(await kioskService.getCompanies());
  } catch (err) { next(err); }
}

async function departments(req, res, next) {
  try {
    res.json(await kioskService.getDepartments(req.query));
  } catch (err) { next(err); }
}

async function units(req, res, next) {
  try {
    res.json(await kioskService.getUnits(req.query));
  } catch (err) { next(err); }
}

async function employees(req, res, next) {
  try {
    res.json(await kioskService.getEmployees(req.query));
  } catch (err) { next(err); }
}

async function status(req, res, next) {
  try {
    const result = await kioskService.getStatus(req.params.employeeId);
    if (!result) return res.status(404).json({ error: 'Employee not found' });
    res.json(result);
  } catch (err) { next(err); }
}

async function insights(req, res, next) {
  try {
    const result = await kioskService.getInsights(req.params.employeeId, req.query.period, req.query.start, req.query.end);
    if (!result) return res.status(404).json({ error: 'Employee not found' });
    res.json(result);
  } catch (err) { next(err); }
}

async function scan(req, res, next) {
  try {
    const { employee_id } = req.body;
    if (!employee_id) return res.status(400).json({ error: 'employee_id is required' });

    const result = await kioskService.scan(req.body);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result);
  } catch (err) { next(err); }
}

module.exports = { companies, departments, units, employees, status, insights, scan };
