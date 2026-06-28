'use strict';

const logger = require('../utils/logger');

/**
 * Request logger middleware — logs method, URL, status, and duration
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'http';

    logger[level](`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`, {
      ip: req.ip,
      userId: req.user?.id || 'anonymous',
      userAgent: req.headers['user-agent'],
    });
  });

  next();
};

module.exports = { requestLogger };
