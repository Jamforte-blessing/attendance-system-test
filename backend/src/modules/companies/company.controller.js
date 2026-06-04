const companyService = require('./company.service');

const { isSuperAdmin } = require('../../shared/utils/adminScope');

async function list(req, res, next) {
  try {
    res.json(await companyService.getAllCompanies(req.user));
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const company = await companyService.getCompanyById(req.params.id, req.user);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    res.json(company);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (!isSuperAdmin(req.user)) return res.status(403).json({ error: 'Only the super admin can create companies' });
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
    const result = await companyService.updateCompany(req.params.id, req.body, req.user);
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
    const result = await companyService.updateCompanyLocation(req.params.id, req.body, req.user);
    if (!result) return res.status(404).json({ error: 'Company not found' });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    if (!isSuperAdmin(req.user)) return res.status(403).json({ error: 'Only the super admin can delete companies' });
    const result = await companyService.deleteCompany(req.params.id, req.user);
    if (!result) return res.status(404).json({ error: 'Company not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function getDepartments(req, res, next) {
  try {
    const result = await companyService.getCompanyDepartments(req.params.id, req.user);
    if (!result) return res.status(404).json({ error: 'Company not found' });
    res.json(result);
  } catch (err) { next(err); }
}

async function createDepartment(req, res, next) {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const result = await companyService.createCompanyDepartment(req.params.id, req.body, req.user);
    if (!result) return res.status(404).json({ error: 'Company not found' });
    res.status(201).json(result);
  } catch (err) { next(err); }
}

async function deleteDepartment(req, res, next) {
  try {
    const result = await companyService.deleteCompanyDepartment(req.params.companyId, req.params.deptId, req.user);
    if (!result) return res.status(404).json({ error: 'Company not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function uploadLogo(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });
    const logoUrl = await companyService.updateCompanyLogo(req.params.id, req.file.buffer, req.user);
    if (!logoUrl) return res.status(404).json({ error: 'Company not found' });
    res.json({ logo_url: logoUrl });
  } catch (err) { next(err); }
}

module.exports = { list, getOne, create, update, updateLocation, uploadLogo, remove, getDepartments, createDepartment, deleteDepartment };
