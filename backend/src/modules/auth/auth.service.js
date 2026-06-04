const jwt = require('jsonwebtoken');
const { queryOne, execute } = require('../../shared/database');
const { sendWelcomeEmail } = require('../../shared/utils/email');
const { verifyPassword, hashPassword, generateRandomPassword } = require('../../shared/utils/password');

const signToken = (payload, expiresIn) =>
  jwt.sign(payload, process.env.JWT_SECRET || 'changeme', { expiresIn });

async function getAdminCompanyIds(adminId) {
  const rows = await queryOne(
    `SELECT COALESCE(array_agg(company_id), '{}') as company_ids
     FROM admin_company_access
     WHERE admin_id = $1`,
    [adminId]
  );
  return rows?.company_ids || [];
}

async function login({ username, email, password }) {
  const loginKey = username || email;
  const envUsername = process.env.ADMIN_USERNAME || 'admin';
  const envPassword = process.env.ADMIN_PASSWORD || 'admin123';

  if (loginKey === 'admin' && loginKey === envUsername && password === envPassword) {
    return {
      token: signToken({ role: 'admin', username: 'admin', isSuperAdmin: true, companyIds: null }, '8h'),
      role: 'admin',
      isSuperAdmin: true,
      companyIds: null,
      mustChangePassword: false,
    };
  }

  const admin = await queryOne('SELECT * FROM admins WHERE username = $1', [loginKey]);
  if (admin && await verifyPassword(password, admin.password_hash)) {
    const companyIds = admin.username === 'admin' ? null : await getAdminCompanyIds(admin.id);
    const isSuperAdmin = admin.username === 'admin';
    return {
      token: signToken({ role: 'admin', username: loginKey, isSuperAdmin, companyIds }, '8h'),
      role: 'admin',
      isSuperAdmin,
      companyIds,
      mustChangePassword: false,
    };
  }

  if (!loginKey) return null;

  const employee = email
    ? await queryOne('SELECT * FROM employees WHERE status = $1 AND lower(email) = lower($2)', ['active', email])
    : await queryOne(
        `SELECT * FROM employees
         WHERE status = $1
           AND (employee_id = $2 OR lower(email) = lower($2))`,
        ['active', loginKey]
      );
  if (employee && employee.password_hash && await verifyPassword(password, employee.password_hash)) {
    return {
      token: signToken(
        { role: 'employee', username, employee_id: employee.employee_id, employee_db_id: employee.id },
        '100d'
      ),
      role: 'employee',
      mustChangePassword: !!employee.must_change_password,
      employee: {
        id: employee.id,
        employee_id: employee.employee_id,
        name: employee.name,
        email: employee.email,
        company_id: employee.company_id,
      },
    };
  }

  return null;
}

async function changePassword({ employee_id, newPassword }) {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters');
  }

  const employee = await queryOne('SELECT * FROM employees WHERE employee_id = $1 AND status = $2', [employee_id, 'active']);
  if (!employee) return false;

  const passwordHash = await hashPassword(newPassword);
  await execute(
    'UPDATE employees SET password_hash = $1, must_change_password = FALSE, password_changed_at = NOW() WHERE employee_id = $2',
    [passwordHash, employee_id]
  );

  return true;
}

async function forgotPassword({ email }) {
  if (!email) {
    throw new Error('Email is required');
  }

  const employee = await queryOne(`
    SELECT e.id, e.employee_id, e.name, e.email, e.shift_start, e.shift_end,
           c.name as company_name, d.name as department_name
    FROM employees e
    LEFT JOIN companies c ON c.id = e.company_id
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE e.status = $1 AND lower(e.email) = lower($2)
  `, ['active', email]);

  if (!employee) return true;

  const password = generateRandomPassword(12);
  const passwordHash = await hashPassword(password);
  await execute(
    'UPDATE employees SET password_hash = $1, must_change_password = TRUE, password_changed_at = NULL, updated_at = NOW() WHERE id = $2',
    [passwordHash, employee.id]
  );

  await sendWelcomeEmail({ ...employee, password });
  await execute(
    'INSERT INTO audit_logs (action, entity, entity_id, details) VALUES ($1, $2, $3, $4)',
    ['FORGOT_PASSWORD', 'employee', employee.id, JSON.stringify({ employee_id: employee.employee_id, email: employee.email })]
  );

  return true;
}

module.exports = { login, changePassword, forgotPassword };
