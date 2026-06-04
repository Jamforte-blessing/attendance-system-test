const employeeService = require('./employee.service');

async function list(req, res, next) {
  try {
    res.json(await employeeService.getAllEmployees(req.query, req.user));
  } catch (err) { next(err); }
}

async function nextId(req, res, next) {
  try {
    const { company_id, department_id, unit_id } = req.query;
    if (!company_id) return res.status(400).json({ error: 'company_id is required' });

    const id = await employeeService.getNextId(company_id, department_id, unit_id, req.user);
    if (!id) return res.status(404).json({ error: 'Company not found' });
    res.json({ id });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const employee = await employeeService.getEmployeeById(req.params.id, req.user);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    res.json(employee);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { employee_id, name } = req.body;
    if (!employee_id || !name) return res.status(400).json({ error: 'employee_id and name are required' });

    const result = await employeeService.createEmployee(req.body, req.user);
    res.status(201).json({ id: result.id, employee_id, name });
  } catch (err) {
    if (err.code === '23505' || err.message.includes('already exists')) {
      return res.status(409).json({ error: `Employee ID "${req.body.employee_id}" already exists. Please regenerate a new ID or delete the existing employee.` });
    }
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const result = await employeeService.updateEmployee(req.params.id, req.body, req.user);
    if (!result) return res.status(404).json({ error: 'Employee not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function generatePassword(req, res, next) {
  try {
    const result = await employeeService.generateEmployeePassword(req.params.id, req.user);
    if (!result) return res.status(404).json({ error: 'Employee not found' });
    res.json({ success: true, message: result.email ? 'Password generated and email sent' : 'Password generated, but no email address is configured' });
  } catch (err) {
    if (err.status === 409) return res.status(409).json({ error: err.message });
    next(err);
  }
}

async function deactivate(req, res, next) {
  try {
    await employeeService.deactivateEmployee(req.params.id, req.user);
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function permanentDelete(req, res, next) {
  try {
    const result = await employeeService.permanentDeleteEmployee(req.params.id, req.user);
    if (!result) return res.status(404).json({ error: 'Employee not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
}

module.exports = { list, nextId, getOne, create, update, generatePassword, deactivate, permanentDelete };
