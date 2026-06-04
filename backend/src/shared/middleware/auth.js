const jwt = require('jsonwebtoken');
const { isSuperAdmin } = require('../utils/adminScope');

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    req.user = jwt.verify(auth.slice(7), process.env.JWT_SECRET || 'changeme');
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

authMiddleware.requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
};

authMiddleware.requireSuperAdmin = (req, res, next) => {
  if (!isSuperAdmin(req.user)) return res.status(403).json({ error: 'Super admin access required' });
  next();
};

module.exports = authMiddleware;
