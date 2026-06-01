const { query, queryOne, execute } = require('../../shared/database');

async function getAllCompanies() {
  return query(`
    SELECT c.*,
           COUNT(DISTINCT e.id)::int as employee_count,
           COUNT(DISTINCT d.id)::int as department_count
    FROM companies c
    LEFT JOIN employees e ON e.company_id = c.id AND e.status = 'active'
    LEFT JOIN departments d ON d.company_id = c.id
    GROUP BY c.id
    ORDER BY c.name
  `);
}

async function getCompanyById(id) {
  return queryOne('SELECT * FROM companies WHERE id = $1', [id]);
}

async function createCompany({ name, address, latitude, longitude, radius_meters }) {
  const result = await execute(
    `INSERT INTO companies (name, address, latitude, longitude, radius_meters) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [name.trim(), address || null, latitude || null, longitude || null, radius_meters || 100]
  );
  await execute(
    'INSERT INTO audit_logs (action, entity, entity_id, details) VALUES ($1, $2, $3, $4)',
    ['CREATE', 'company', result.id, JSON.stringify({ name })]
  );
  return result;
}

async function updateCompany(id, { name, address, radius_meters }) {
  const company = await queryOne('SELECT id FROM companies WHERE id = $1', [id]);
  if (!company) return null;

  await execute(
    `UPDATE companies SET name = $1, address = $2, radius_meters = $3 WHERE id = $4`,
    [name.trim(), address || null, radius_meters || 100, id]
  );
  return true;
}

async function updateCompanyLocation(id, { latitude, longitude, radius_meters }) {
  await execute(
    `UPDATE companies SET latitude = $1, longitude = $2, radius_meters = $3 WHERE id = $4`,
    [latitude, longitude, radius_meters || 100, id]
  );
  return { latitude, longitude, radius_meters: radius_meters || 100 };
}

async function deleteCompany(id) {
  const company = await queryOne('SELECT id FROM companies WHERE id = $1', [id]);
  if (!company) return null;

  await execute('UPDATE employees SET company_id = NULL WHERE company_id = $1', [id]);
  await execute('UPDATE departments SET company_id = NULL WHERE company_id = $1', [id]);
  await execute('DELETE FROM companies WHERE id = $1', [id]);
  await execute(
    'INSERT INTO audit_logs (action, entity, entity_id, details) VALUES ($1, $2, $3, $4)',
    ['DELETE', 'company', id, null]
  );
  return true;
}

async function getCompanyDepartments(id) {
  return query(
    `SELECT d.*, COUNT(e.id)::int as employee_count
     FROM departments d
     LEFT JOIN employees e ON e.department_id = d.id AND e.status = 'active'
     WHERE d.company_id = $1
     GROUP BY d.id
     ORDER BY d.name`,
    [id]
  );
}

async function createCompanyDepartment(companyId, { name }) {
  const result = await execute(
    'INSERT INTO departments (name, company_id) VALUES ($1, $2) RETURNING id',
    [name.trim(), companyId]
  );
  return { id: result.id, name, company_id: parseInt(companyId) };
}

async function deleteCompanyDepartment(companyId, deptId) {
  await execute('UPDATE employees SET department_id = NULL WHERE department_id = $1', [deptId]);
  await execute('DELETE FROM departments WHERE id = $1 AND company_id = $2', [deptId, companyId]);
}

module.exports = {
  getAllCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  updateCompanyLocation,
  deleteCompany,
  getCompanyDepartments,
  createCompanyDepartment,
  deleteCompanyDepartment,
};
