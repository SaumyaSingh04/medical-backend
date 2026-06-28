'use strict';

const analytics = require('../services/analyticsService');
const { sendSuccess, sendPaginated } = require('../helpers/ApiResponse');
const { parsePagination, buildPaginationMeta } = require('../helpers/paginate');
const asyncHandler = require('../utils/asyncHandler');

const getSummary = asyncHandler(async (req, res) => {
  const data = await analytics.getSummary();
  sendSuccess(res, 'Analytics summary', data);
});

const getLoginGraph = asyncHandler(async (req, res) => {
  const { period = 'daily' } = req.query;
  const data = await analytics.getLoginGraph(period);
  sendSuccess(res, 'Login graph', data);
});

const getRegistrationTrend = asyncHandler(async (req, res) => {
  const days = Math.min(parseInt(req.query.days, 10) || 30, 365);
  const data = await analytics.getRegistrationTrend(days);
  sendSuccess(res, 'Registration trend', data);
});

const getMostActiveUsers = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  const data = await analytics.getMostActiveUsers(limit);
  sendSuccess(res, 'Most active users', data);
});

const getRecentActivities = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const data = await analytics.getRecentActivities(limit);
  sendSuccess(res, 'Recent activities', data);
});

const getLoginHistory = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { userId, startDate, endDate, success } = req.query;
  const { data, total } = await analytics.getLoginHistory({ userId, page, limit, skip, startDate, endDate, success });
  sendPaginated(res, 'Login history', data, buildPaginationMeta(total, page, limit));
});

const getRegistrationHistory = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { startDate, endDate } = req.query;
  const { data, total } = await analytics.getRegistrationHistory({ page, limit, skip, startDate, endDate });
  sendPaginated(res, 'Registration history', data, buildPaginationMeta(total, page, limit));
});

const getActivityHistory = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { userId, action, startDate, endDate } = req.query;
  const { data, total } = await analytics.getActivityHistory({ userId, action, page, limit, skip, startDate, endDate });
  sendPaginated(res, 'Activity history', data, buildPaginationMeta(total, page, limit));
});

const getSessionHistory = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { userId, startDate, endDate, isActive } = req.query;
  const { data, total } = await analytics.getSessionHistory({ userId, page, limit, skip, startDate, endDate, isActive });
  sendPaginated(res, 'Session history', data, buildPaginationMeta(total, page, limit));
});

// ─── CSV Export ───────────────────────────────────────────────────────────────
function toCSV(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => {
      const v = row[h] == null ? '' : String(row[h]).replace(/"/g, '""');
      return `"${v}"`;
    }).join(','));
  }
  return lines.join('\n');
}

const exportHistory = asyncHandler(async (req, res) => {
  const { type = 'activity', startDate, endDate, format = 'csv' } = req.query;
  let rows = [];

  if (type === 'login') {
    const r = await analytics.getLoginHistory({ limit: 10000, skip: 0, startDate, endDate });
    rows = r.data;
  } else if (type === 'registration') {
    const r = await analytics.getRegistrationHistory({ limit: 10000, skip: 0, startDate, endDate });
    rows = r.data;
  } else if (type === 'session') {
    const r = await analytics.getSessionHistory({ limit: 10000, skip: 0, startDate, endDate });
    rows = r.data;
  } else {
    const r = await analytics.getActivityHistory({ limit: 10000, skip: 0, startDate, endDate });
    rows = r.data.map(({ user, ...rest }) => ({
      ...rest,
      userName: user ? `${user.firstName} ${user.lastName}` : null,
      userEmail: user?.email || null,
    }));
  }

  const csv = toCSV(rows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${type}-export-${Date.now()}.csv"`);
  res.send(csv);
});

module.exports = {
  getSummary,
  getLoginGraph,
  getRegistrationTrend,
  getMostActiveUsers,
  getRecentActivities,
  getLoginHistory,
  getRegistrationHistory,
  getActivityHistory,
  getSessionHistory,
  exportHistory,
};
