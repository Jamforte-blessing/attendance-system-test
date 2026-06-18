const { query, queryOne, execute } = require('../../shared/database');
const { addCompanyScope } = require('../../shared/utils/adminScope');
const { uploadBuffer } = require('../../shared/utils/cloudinary');

async function getAllCompanies(user) {
  const scoped = addCompanyScope({
    sql: '',
    params: [],
    column: 'c.id',
    user,
  });
  return query(`
    SELECT c.*,
           COUNT(DISTINCT e.id)::int as employee_count,
           COUNT(DISTINCT d.id)::int as department_count
    FROM companies c
    LEFT JOIN employees e ON e.company_id = c.id AND e.status = 'active'
    LEFT JOIN departments d ON d.company_id = c.id
    WHERE 1=1 ${scoped.sql}
    GROUP BY c.id
    ORDER BY c.name
  `, scoped.params);
}

async function getCompanyById(id, user) {
  const params = [id];
  const scoped = addCompanyScope({ sql: '', params, column: 'id', user });
  return queryOne(`SELECT * FROM companies WHERE id = $1 ${scoped.sql}`, scoped.params);
}

async function createCompany({ name, address, latitude, longitude, radius_meters, default_shift_start, default_shift_end }) {
  const result = await execute(
    `INSERT INTO companies (name, address, latitude, longitude, radius_meters, default_shift_start, default_shift_end)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [name.trim(), address || null, latitude || null, longitude || null, radius_meters || 100,
     default_shift_start || '09:00', default_shift_end || '17:00']
  );
  await execute(
    'INSERT INTO audit_logs (action, entity, entity_id, details) VALUES ($1, $2, $3, $4)',
    ['CREATE', 'company', result.id, JSON.stringify({ name })]
  );
  return result;
}

async function updateCompany(id, { name, address, radius_meters, default_shift_start, default_shift_end }, user) {
  const company = await getCompanyById(id, user);
  if (!company) return null;

  const shiftStart = default_shift_start || '09:00';
  const shiftEnd = default_shift_end || '17:00';

  await execute(
    `UPDATE companies SET name = $1, address = $2, radius_meters = $3, default_shift_start = $4, default_shift_end = $5 WHERE id = $6`,
    [name.trim(), address || null, radius_meters || 100,
     shiftStart, shiftEnd, id]
  );

  await execute(
    'UPDATE employees SET shift_start = $1, shift_end = $2 WHERE company_id = $3',
    [shiftStart, shiftEnd, id]
  );

  return true;
}

async function updateCompanyLocation(id, { latitude, longitude, radius_meters }, user) {
  const company = await getCompanyById(id, user);
  if (!company) return null;
  await execute(
    `UPDATE companies SET latitude = $1, longitude = $2, radius_meters = $3 WHERE id = $4`,
    [latitude, longitude, radius_meters || 100, id]
  );
  return { latitude, longitude, radius_meters: radius_meters || 100 };
}

async function refreshAllLocations() {
  const companies = await query(
    `SELECT id, name, address FROM companies WHERE address IS NOT NULL AND address != '' ORDER BY id`
  );

  const results = { updated: [], failed: [], skipped: [] };

  for (const company of companies) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(company.address)}&format=json&limit=1`;

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'AttendanceSaaS/1.0' },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      if (!data.length) {
        results.skipped.push({ id: company.id, name: company.name, reason: 'No geocoding result for address' });
      } else {
        const { lat, lon } = data[0];
        await execute(
          `UPDATE companies SET latitude = $1, longitude = $2 WHERE id = $3`,
          [parseFloat(lat), parseFloat(lon), company.id]
        );
        results.updated.push({ id: company.id, name: company.name, latitude: parseFloat(lat), longitude: parseFloat(lon) });
      }
    } catch (err) {
      results.failed.push({ id: company.id, name: company.name, reason: err.message });
    }

    // Nominatim rate limit: max 1 request per second
    await new Promise(r => setTimeout(r, 1100));
  }

  return results;
}

async function deleteCompany(id, user) {
  const company = await getCompanyById(id, user);
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

async function getCompanyDepartments(id, user) {
  const company = await getCompanyById(id, user);
  if (!company) return null;
  return query(
    `SELECT d.*,
            COUNT(DISTINCT e.id)::int as employee_count,
            COUNT(DISTINCT u.id)::int as unit_count
     FROM departments d
     LEFT JOIN employees e ON e.department_id = d.id AND e.status = 'active'
     LEFT JOIN units u ON u.department_id = d.id
     WHERE d.company_id = $1
     GROUP BY d.id
     ORDER BY d.name`,
    [id]
  );
}

async function createCompanyDepartment(companyId, { name }, user) {
  const company = await getCompanyById(companyId, user);
  if (!company) return null;
  const result = await execute(
    'INSERT INTO departments (name, company_id) VALUES ($1, $2) RETURNING id',
    [name.trim(), companyId]
  );
  return { id: result.id, name, company_id: parseInt(companyId) };
}

async function deleteCompanyDepartment(companyId, deptId, user) {
  const company = await getCompanyById(companyId, user);
  if (!company) return null;
  await execute('UPDATE employees SET unit_id = NULL WHERE unit_id IN (SELECT id FROM units WHERE department_id = $1)', [deptId]);
  await execute('UPDATE employees SET department_id = NULL WHERE department_id = $1', [deptId]);
  await execute('DELETE FROM departments WHERE id = $1 AND company_id = $2', [deptId, companyId]);
}

async function updateCompanyLogo(id, buffer, user) {
  const company = await getCompanyById(id, user);
  if (!company) return null;
  const result = await uploadBuffer(buffer, {
    folder: 'company-logos',
    resource_type: 'image',
    public_id: `company-${id}-logo`,
    overwrite: true,
    invalidate: true,
  });
  await execute('UPDATE companies SET logo_url = $1 WHERE id = $2', [result.secure_url, id]);
  return result.secure_url;
}

module.exports = {
  getAllCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  updateCompanyLocation,
  updateCompanyLogo,
  deleteCompany,
  getCompanyDepartments,
  createCompanyDepartment,
  deleteCompanyDepartment,
  refreshAllLocations,
};
