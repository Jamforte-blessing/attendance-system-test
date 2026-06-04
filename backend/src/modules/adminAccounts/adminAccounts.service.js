const { query, execute, transaction } = require('../../shared/database');
const { hashPassword, generateRandomPassword } = require('../../shared/utils/password');

async function getAll() {
  return query(`
    SELECT a.id, a.username, a.generated_password, a.created_at,
           COALESCE(json_agg(json_build_object('id', c.id, 'name', c.name) ORDER BY c.name) FILTER (WHERE c.id IS NOT NULL), '[]') as companies
    FROM admins a
    LEFT JOIN admin_company_access aca ON aca.admin_id = a.id
    LEFT JOIN companies c ON c.id = aca.company_id
    GROUP BY a.id
    ORDER BY a.created_at
  `);
}

async function create({ username, company_ids }) {
  if (username === 'admin') {
    throw Object.assign(new Error('Username is reserved'), { reserved: true });
  }
  const companyIds = Array.isArray(company_ids) ? company_ids.map(id => parseInt(id, 10)).filter(Number.isFinite) : [];
  if (companyIds.length === 0) {
    throw Object.assign(new Error('Assign at least one company'), { validation: true });
  }

  const password = generateRandomPassword(12);
  const hash = await hashPassword(password);
  return transaction(async client => {
    const result = await client.query(
      'INSERT INTO admins (username, password_hash, generated_password) VALUES ($1, $2, $3) RETURNING id, username, generated_password, created_at',
      [username.trim(), hash, password]
    );
    const admin = result.rows[0];
    for (const companyId of companyIds) {
      await client.query(
        'INSERT INTO admin_company_access (admin_id, company_id) VALUES ($1, $2)',
        [admin.id, companyId]
      );
    }
    return admin;
  });
}

async function remove(username) {
  if (username === 'admin') {
    throw Object.assign(new Error('Cannot delete the primary admin'), { forbidden: true });
  }
  await execute('DELETE FROM admins WHERE username = $1', [username]);
}

module.exports = { getAll, create, remove };
