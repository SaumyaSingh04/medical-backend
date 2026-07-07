'use strict';

const analytics = require('../services/analyticsService');
const { sendSuccess, sendPaginated } = require('../helpers/ApiResponse');
const { parsePagination, buildPaginationMeta } = require('../helpers/paginate');
const { sendCSV } = require('../utils/exportUtils');
const asyncHandler = require('../utils/asyncHandler');
const { MESSAGES } = require('../constants');

// Factory for paginated history handlers that share the same pagination + date-filter pattern
const paginatedHistory = (method, extraKeys = []) =>
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const extra = Object.fromEntries(extraKeys.map((k) => [k, req.query[k]]));
    const { data, total } = await analytics[method]({ page, limit, skip, ...extra });
    sendPaginated(res, MESSAGES.FETCHED, data, buildPaginationMeta(total, page, limit));
  });

const getSummary = asyncHandler(async (req, res) => {
  sendSuccess(res, MESSAGES.FETCHED, await analytics.getSummary());
});

const getLoginGraph = asyncHandler(async (req, res) => {
  sendSuccess(res, MESSAGES.FETCHED, await analytics.getLoginGraph(req.query.period || 'daily'));
});

const getRegistrationTrend = asyncHandler(async (req, res) => {
  const days = Math.min(parseInt(req.query.days, 10) || 30, 365);
  sendSuccess(res, MESSAGES.FETCHED, await analytics.getRegistrationTrend(days));
});

const getMostActiveUsers = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  sendSuccess(res, MESSAGES.FETCHED, await analytics.getMostActiveUsers(limit));
});

const getRecentActivities = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  sendSuccess(res, MESSAGES.FETCHED, await analytics.getRecentActivities(limit));
});

const getLoginHistory       = paginatedHistory('getLoginHistory',       ['userId', 'startDate', 'endDate', 'success']);
const getRegistrationHistory = paginatedHistory('getRegistrationHistory', ['startDate', 'endDate']);
const getActivityHistory    = paginatedHistory('getActivityHistory',    ['userId', 'action', 'startDate', 'endDate']);
const getSessionHistory     = paginatedHistory('getSessionHistory',     ['userId', 'startDate', 'endDate', 'isActive']);

const exportHistory = asyncHandler(async (req, res) => {
  const { type = 'activity', startDate, endDate } = req.query;
  const opts = { limit: 10000, skip: 0, startDate, endDate };

  const historyMap = {
    login:        () => analytics.getLoginHistory(opts),
    registration: () => analytics.getRegistrationHistory(opts),
    session:      () => analytics.getSessionHistory(opts),
  };

  let rows;
  if (historyMap[type]) {
    ({ data: rows } = await historyMap[type]());
  } else {
    const { data } = await analytics.getActivityHistory(opts);
    rows = data.map(({ user, ...rest }) => ({
      ...rest,
      userName:  user ? `${user.firstName} ${user.lastName}` : null,
      userEmail: user?.email ?? null,
    }));
  }

  if (!rows.length) return res.status(200).json({ success: true, message: 'No data to export.' });

  const headers = Object.keys(rows[0]);
  sendCSV(res, type, headers, rows.map((r) => headers.map((h) => r[h])));
});

module.exports = {
  getSummary, getLoginGraph, getRegistrationTrend, getMostActiveUsers,
  getRecentActivities, getLoginHistory, getRegistrationHistory,
  getActivityHistory, getSessionHistory, exportHistory,
};
