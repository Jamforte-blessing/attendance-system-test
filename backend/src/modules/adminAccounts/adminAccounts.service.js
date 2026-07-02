const { query, queryOne, execute, transaction } = require('../../shared/database');
const { hashPassword, generateRandomPassword } = require('../../shared/utils/password');
const { getSuperAdminUsername } = require('../../shared/utils/adminScope');
const { sendAdminCredentialsEmail } = require('../../shared/utils/email');

async function getAll() {
  return query(`
    SELECT a.id, a.username, a.email, a.generated_password, a.created_at,
           COALESCE(json_agg(json_build_object('id', c.id, 'name', c.name) ORDER BY c.name) FILTER (WHERE c.id IS NOT NULL), '[]') as companies
    FROM admins a
    LEFT JOIN admin_company_access aca ON aca.admin_id = a.id
    LEFT JOIN companies c ON c.id = aca.company_id
    WHERE a.is_super_admin = FALSE
    GROUP BY a.id
    ORDER BY a.created_at
  `);
}

async function create({ username, email, company_ids }) {
  if (username?.trim() === getSuperAdminUsername()) {
    throw Object.assign(new Error('Username is reserved'), { reserved: true });
  }
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw Object.assign(new Error('A valid email address is required'), { validation: true });
  }
  const companyIds = Array.isArray(company_ids) ? company_ids.map(id => parseInt(id, 10)).filter(Number.isFinite) : [];
  if (companyIds.length === 0) {
    throw Object.assign(new Error('Assign at least one company'), { validation: true });
  }

  const password = generateRandomPassword(12);
  const hash = await hashPassword(password);
  const admin = await transaction(async client => {
    const result = await client.query(
      'INSERT INTO admins (username, email, password_hash, generated_password) VALUES ($1, $2, $3, $4) RETURNING id, username, email, generated_password, created_at',
      [username.trim(), normalizedEmail, hash, password]
    );
    const admin = result.rows[0];
    for (const companyId of companyIds) {
      await client.query(
        'INSERT INTO admin_company_access (admin_id, company_id) VALUES ($1, $2)',
        [admin.id, companyId]
      );
    }
    const companies = await client.query(
      'SELECT name FROM companies WHERE id = ANY($1::int[]) ORDER BY name',
      [companyIds]
    );
    return { ...admin, company_names: companies.rows.map(company => company.name) };
  });

  let emailSent = false;
  try {
    emailSent = await sendAdminCredentialsEmail({
      username: admin.username,
      email: admin.email,
      password: admin.generated_password,
      companyNames: admin.company_names,
    });
  } catch (err) {
    console.error(`Admin credentials email failed for ${admin.email}:`, err.message);
  }

  return { ...admin, email_sent: emailSent };
}

async function remove(username) {
  const admin = await queryOne('SELECT is_super_admin FROM admins WHERE username = $1', [username]);
  if (admin?.is_super_admin) {
    throw Object.assign(new Error('Cannot delete the primary admin'), { forbidden: true });
  }
  await execute('DELETE FROM admins WHERE username = $1', [username]);
}

module.exports = { getAll, create, remove };
