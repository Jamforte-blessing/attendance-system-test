function getSuperAdminUsername() {
  return process.env.ADMIN_USERNAME?.trim() || 'admin';
}

function isSuperAdmin(user) {
  return user?.role === 'admin' && user?.isSuperAdmin === true;
}

function getCompanyIds(user) {
  if (isSuperAdmin(user)) return null;
  if (!Array.isArray(user?.companyIds)) return [];
  return user.companyIds.map(id => parseInt(id, 10)).filter(Number.isFinite);
}

function canAccessCompany(user, companyId) {
  if (isSuperAdmin(user)) return true;
  const id = parseInt(companyId, 10);
  return Number.isFinite(id) && getCompanyIds(user).includes(id);
}

function requireCompanyAccess(user, companyId) {
  if (!canAccessCompany(user, companyId)) {
    const error = new Error('You do not have access to this company');
    error.status = 403;
    throw error;
  }
}

function addCompanyScope({ sql, params, column, user }) {
  const ids = getCompanyIds(user);
  if (ids === null) return { sql, params };
  if (ids.length === 0) return { sql: `${sql} AND 1=0`, params };
  params.push(ids);
  return { sql: `${sql} AND ${column} = ANY($${params.length}::int[])`, params };
}

module.exports = {
  getSuperAdminUsername,
  isSuperAdmin,
  getCompanyIds,
  canAccessCompany,
  requireCompanyAccess,
  addCompanyScope,
};
