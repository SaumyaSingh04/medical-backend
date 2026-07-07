'use strict';

const ApiError = require('../helpers/ApiError');

// Usage: authorize('admin') or authorize('admin', 'super_admin')
const authorize = (...roles) => (req, res, next) => {
  if (!req.user)                      return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) return next(ApiError.forbidden(`Access restricted to: ${roles.join(', ')}`));
  next();
};

module.exports = { authorize };
