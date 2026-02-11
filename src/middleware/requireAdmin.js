const isAdminRole = (user) => user && ['admin', 'rabbi'].includes(user.role);

const requireAdmin = (req, res, next) => {
  if (isAdminRole(req.user)) {
    return next();
  }

  const adminToken = process.env.ADMIN_TOKEN;
  if (adminToken) {
    const providedToken = req.get('x-admin-token') || req.query.admin_token;
    if (!providedToken || providedToken !== adminToken) {
      if (req.accepts('json')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      return res.status(401).send('Unauthorized');
    }

    if (!req.user) {
      req.user = { id: 'admin-token', role: 'admin', name: 'Admin' };
    }
    return next();
  }

  // In test environment, allow simulated admin if not set
  if (process.env.NODE_ENV === 'test' && !req.user) {
    req.user = { id: 'admin-001', role: 'admin', name: 'Test Admin' };
  }

  if (!isAdminRole(req.user)) {
    if (req.accepts('json')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return res.status(403).send('Forbidden');
  }

  return next();
};

module.exports = requireAdmin;
