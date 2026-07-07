'use strict';

const { HTTP_STATUS } = require('../constants');

const sendSuccess = (res, message = 'Success', data = null, statusCode = HTTP_STATUS.OK, meta = null) =>
  res.status(statusCode).json({
    success: true,
    message,
    ...(data !== null && { data }),
    ...(meta && { meta }),
    timestamp: new Date().toISOString(),
  });

const sendError = (res, message = 'Error', statusCode = HTTP_STATUS.INTERNAL_ERROR, errors = null) =>
  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
    timestamp: new Date().toISOString(),
  });

const sendPaginated = (res, message, data, pagination) =>
  sendSuccess(res, message, data, HTTP_STATUS.OK, { pagination });

module.exports = { sendSuccess, sendError, sendPaginated };
