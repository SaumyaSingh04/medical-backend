'use strict';

const auditLogService = require('../services/auditLogService');
const { sendPaginated } = require('../helpers/ApiResponse');
const asyncHandler      = require('../utils/asyncHandler');
const { MESSAGES }      = require('../constants');

const getLogs = asyncHandler(async (req, res) => {
  const result = await auditLogService.getLogs(req.query);
  sendPaginated(res, MESSAGES.FETCHED, result.logs, result.meta);
});

module.exports = { getLogs };
