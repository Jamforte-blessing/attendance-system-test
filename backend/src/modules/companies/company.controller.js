const companyService = require('./company.service');

async function list(_req, res, next) {
  try {
    res.json(await companyService.getAllCompanies());
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const company = await companyService.getCompanyById(req.params.id);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    res.json(company);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const result = await companyService.createCompany(req.body);
    res.status(201).json({ id: result.id, name });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Company name already exists' });
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const result = await companyService.updateCompany(req.params.id, req.body);
    if (!result) return res.status(404).json({ error: 'Company not found' });
    res.json({ success: true });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Company name already exists' });
    next(err);
  }
}

async function updateLocation(req, res, next) {
  try {
    const { latitude, longitude } = req.body;
    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: 'latitude and longitude are required' });
    }
    const result = await companyService.updateCompanyLocation(req.params.id, req.body);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const result = await companyService.deleteCompany(req.params.id);
    if (!result) return res.status(404).json({ error: 'Company not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function getDepartments(req, res, next) {
  try {
    res.json(await companyService.getCompanyDepartments(req.params.id));
  } catch (err) { next(err); }
}

async function createDepartment(req, res, next) {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const result = await companyService.createCompanyDepartment(req.params.id, req.body);
    res.status(201).json(result);
  } catch (err) { next(err); }
}

async function deleteDepartment(req, res, next) {
  try {
    await companyService.deleteCompanyDepartment(req.params.companyId, req.params.deptId);
    res.json({ success: true });
  } catch (err) { next(err); }
}

module.exports = { list, getOne, create, update, updateLocation, remove, getDepartments, createDepartment, deleteDepartment };
