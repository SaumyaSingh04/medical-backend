'use strict';

const { HTTP_STATUS } = require('../constants');

class ApiError extends Error {
  constructor(message, statusCode = HTTP_STATUS.INTERNAL_ERROR, errors = null, isOperational = true) {
    super(message);
    this.name         = 'ApiError';
    this.statusCode   = statusCode;
    this.errors       = errors;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, errors = null)      { return new ApiError(message, HTTP_STATUS.BAD_REQUEST, errors); }
  static unauthorized(message = 'Authentication required') { return new ApiError(message, HTTP_STATUS.UNAUTHORIZED); }
  static forbidden(message = 'Access denied')    { return new ApiError(message, HTTP_STATUS.FORBIDDEN); }
  static notFound(message = 'Resource not found') { return new ApiError(message, HTTP_STATUS.NOT_FOUND); }
  static conflict(message)                        { return new ApiError(message, HTTP_STATUS.CONFLICT); }
  static unprocessable(message, errors = null)   { return new ApiError(message, HTTP_STATUS.UNPROCESSABLE, errors); }
  static tooManyRequests(message = 'Too many requests') { return new ApiError(message, HTTP_STATUS.TOO_MANY_REQUESTS); }
  static internal(message = 'Internal server error') { return new ApiError(message, HTTP_STATUS.INTERNAL_ERROR, null, false); }
}

module.exports = ApiError;
