'use strict';

const logger = require('../utils/logger');
const ApiError = require('../helpers/ApiError');
const { HTTP_STATUS, MESSAGES } = require('../constants');

const PRISMA_ERROR_MAP = {
  P2002: (err) => ({ statusCode: HTTP_STATUS.CONFLICT,    message: `${err.meta?.target?.[0] || 'Field'} already exists.` }),
  P2025: (err) => ({ statusCode: HTTP_STATUS.NOT_FOUND,   message: err.meta?.cause || 'Record not found.' }),
  P2003: ()    => ({ statusCode: HTTP_STATUS.BAD_REQUEST, message: 'Related record not found.' }),
  P2000: ()    => ({ statusCode: HTTP_STATUS.BAD_REQUEST, message: 'Input value is too long.' }),
  P2011: ()    => ({ statusCode: HTTP_STATUS.BAD_REQUEST, message: 'Required field is missing.' }),
  P2014: ()    => ({ statusCode: HTTP_STATUS.BAD_REQUEST, message: 'Relation violation: required relation missing.' }),
  P2016: ()    => ({ statusCode: HTTP_STATUS.NOT_FOUND,   message: 'Record not found.' }),
  P2021: ()    => ({ statusCode: HTTP_STATUS.INTERNAL_ERROR, message: 'Database table not found.' }),
  P2022: ()    => ({ statusCode: HTTP_STATUS.INTERNAL_ERROR, message: 'Database column not found.' }),
};

const notFound = (req, res, next) =>
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || HTTP_STATUS.INTERNAL_ERROR;
  let message    = err.message    || MESSAGES.INTERNAL_ERROR;
  let errors     = err.errors     || null;

  const prismaHandler = PRISMA_ERROR_MAP[err.code];
  if (prismaHandler) ({ statusCode, message } = prismaHandler(err));

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = HTTP_STATUS.UNAUTHORIZED;
    message    = 'Invalid or expired token.';
    errors     = null; // never leak JWT internals
  }

  // Non-operational errors (bugs) should not leak details in production.
  if (err.isOperational === false && process.env.NODE_ENV === 'production') {
    message = MESSAGES.INTERNAL_ERROR;
    errors  = null;
  }

  const ctx = {
    requestId: req.requestId,
    method:    req.method,
    path:      req.path,
    statusCode,
    userId:    req.user?.id ?? null,
  };

  if (statusCode >= 500) logger.error(message, { ...ctx, stack: err.stack });
  else                   logger.warn(message, ctx);

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = { notFound, errorHandler };
