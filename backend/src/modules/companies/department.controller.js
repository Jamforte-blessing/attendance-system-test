const departmentService = require('./department.service');

async function list(req, res, next) {
  try {
    res.json(await departmentService.getAllDepartments(req.query, req.user));
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { name, company_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const result = await departmentService.createDepartment(req.body, req.user);
    res.status(201).json({ id: result.id, name, company_id: company_id || null });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const result = await departmentService.updateDepartment(req.params.id, req.body, req.user);
    if (!result) return res.status(404).json({ error: 'Department not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const result = await departmentService.deleteDepartment(req.params.id, req.user);
    if (!result) return res.status(404).json({ error: 'Department not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
}

module.exports = { list, create, update, remove };
