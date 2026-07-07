'use strict';

const crypto = require('crypto');
const prisma = require('../repositories/prismaClient');
const { UAParser } = require('ua-parser-js');

function parseUA(userAgent = '') {
  const r = new UAParser(userAgent).getResult();
  return {
    device:  r.device.type  || 'desktop',
    browser: r.browser.name || 'Unknown',
    os:      r.os.name      || 'Unknown',
  };
}

function getIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    req.ip ||
    null
  );
}

const API_UA_PATTERNS = ['axios', 'curl', 'PostmanRuntime'];
function detectSource(req) {
  const ua = req.headers['user-agent'] || '';
  if (!ua || API_UA_PATTERNS.some((p) => ua.includes(p))) return 'api';
  if (/mobile|android|iphone|ipad/i.test(ua)) return 'mobile';
  return 'web';
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function track(fn) {
  Promise.resolve(fn()).catch(() => {});
}

async function trackRegistration(req, userId, email) {
  const ua = parseUA(req.headers['user-agent']);
  await prisma.registrationLog.create({
    data: {
      userId, email,
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
      device: ua.device, browser: ua.browser, os: ua.os,
      source: detectSource(req),
    },
  });
}

async function trackLogin(req, { userId, email, success, failReason, sessionToken }) {
  const ua        = parseUA(req.headers['user-agent']);
  const ip        = getIp(req);
  const userAgent = req.headers['user-agent'];

  if (success && sessionToken) {
    const session = await prisma.userSession.create({
      data: {
        userId,
        sessionToken: hashToken(sessionToken),
        ipAddress: ip, userAgent,
        device: ua.device, browser: ua.browser, os: ua.os,
      },
    });
    prisma.loginHistory.create({
      data: {
        userId, email, success, failReason: null,
        ipAddress: ip, userAgent,
        device: ua.device, browser: ua.browser, os: ua.os,
        sessionId: session.id,
      },
    }).catch(() => {});
    return session.id;
  }

  await prisma.loginHistory.create({
    data: {
      userId: userId || null, email, success,
      failReason: failReason || null,
      ipAddress: ip, userAgent,
      device: ua.device, browser: ua.browser, os: ua.os,
    },
  });
  return null;
}

async function trackLogout(userId, sessionId) {
  const session = sessionId
    ? await prisma.userSession.findUnique({ where: { id: sessionId }, select: { id: true, loginAt: true } })
    : await prisma.userSession.findFirst({ where: { userId, isActive: true }, orderBy: { loginAt: 'desc' }, select: { id: true, loginAt: true } });
  if (!session) return;
  const duration = Math.floor((Date.now() - session.loginAt.getTime()) / 1000);
  await prisma.userSession.update({
    where: { id: session.id },
    data: { isActive: false, logoutAt: new Date(), durationSeconds: duration },
  });
}

async function trackActivity(req, res, action) {
  await prisma.activityLog.create({
    data: {
      userId:     req.user?.id || null,
      action,
      method:     req.method,
      endpoint:   req.originalUrl?.split('?')[0],
      statusCode: res.statusCode,
      ipAddress:  getIp(req),
      userAgent:  req.headers['user-agent'],
      meta:       req.analyticsMeta || null,
    },
  });
}

// ─── Analytics queries ────────────────────────────────────────────────────────

async function getSummary() {
  const now        = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart  = new Date(todayStart); weekStart.setDate(todayStart.getDate() - 6);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalUsers, newToday, newWeek, newMonth,
    activeToday, totalLogins, successLogins, failedLogins,
    currentlyActive, avgDuration,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.registrationLog.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.registrationLog.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.registrationLog.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.userSession.count({ where: { loginAt: { gte: todayStart } } }),
    prisma.loginHistory.count(),
    prisma.loginHistory.count({ where: { success: true } }),
    prisma.loginHistory.count({ where: { success: false } }),
    prisma.userSession.count({ where: { isActive: true } }),
    prisma.userSession.aggregate({ _avg: { durationSeconds: true }, where: { durationSeconds: { not: null } } }),
  ]);

  return {
    totalUsers,
    newUsersToday:             newToday,
    newUsersThisWeek:          newWeek,
    newUsersThisMonth:         newMonth,
    activeUsersToday:          activeToday,
    totalLogins,
    successfulLogins:          successLogins,
    failedLogins,
    currentlyActiveUsers:      currentlyActive,
    avgSessionDurationSeconds: Math.round(avgDuration._avg.durationSeconds || 0),
  };
}

async function getLoginGraph(period = 'daily') {
  const now = new Date();
  const startDate = new Date(now);
  const truncMap = { weekly: 'week', monthly: 'month', daily: 'day' };
  if (period === 'weekly') startDate.setDate(now.getDate() - 6 * 7);
  else if (period === 'monthly') startDate.setFullYear(now.getFullYear() - 1);
  else startDate.setDate(now.getDate() - 29);

  const trunc = truncMap[period] || 'day';
  // Use tagged template literals (parameterized) — trunc is validated against truncMap, not user input
  let rows;
  if (trunc === 'week') {
    rows = await prisma.$queryRaw`SELECT DATE_TRUNC('week', "createdAt") AS period, COUNT(*)::int AS total, SUM(CASE WHEN success = true THEN 1 ELSE 0 END)::int AS successful, SUM(CASE WHEN success = false THEN 1 ELSE 0 END)::int AS failed FROM "LoginHistory" WHERE "createdAt" >= ${startDate} GROUP BY 1 ORDER BY 1`;
  } else if (trunc === 'month') {
    rows = await prisma.$queryRaw`SELECT DATE_TRUNC('month', "createdAt") AS period, COUNT(*)::int AS total, SUM(CASE WHEN success = true THEN 1 ELSE 0 END)::int AS successful, SUM(CASE WHEN success = false THEN 1 ELSE 0 END)::int AS failed FROM "LoginHistory" WHERE "createdAt" >= ${startDate} GROUP BY 1 ORDER BY 1`;
  } else {
    rows = await prisma.$queryRaw`SELECT DATE_TRUNC('day', "createdAt") AS period, COUNT(*)::int AS total, SUM(CASE WHEN success = true THEN 1 ELSE 0 END)::int AS successful, SUM(CASE WHEN success = false THEN 1 ELSE 0 END)::int AS failed FROM "LoginHistory" WHERE "createdAt" >= ${startDate} GROUP BY 1 ORDER BY 1`;
  }
  return rows.map(({ period: p, total, successful, failed }) => ({ period: p, total, successful, failed }));
}

async function getRegistrationTrend(days = 30) {
  const startDate = new Date(); startDate.setDate(startDate.getDate() - (days - 1));
  const rows = await prisma.$queryRaw`
    SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*)::int AS count
    FROM "RegistrationLog" WHERE "createdAt" >= ${startDate}
    GROUP BY 1 ORDER BY 1`;
  return rows.map((r) => ({ day: r.day, count: r.count }));
}

async function getMostActiveUsers(limit = 10) {
  const safeLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const rows = await prisma.$queryRaw`
    SELECT a."userId", u."firstName", u."lastName", u."email",
           COUNT(*)::int AS actions
    FROM "ActivityLog" a
    LEFT JOIN "User" u ON u.id = a."userId"
    WHERE a."userId" IS NOT NULL
    GROUP BY a."userId", u."firstName", u."lastName", u."email"
    ORDER BY actions DESC
    LIMIT ${safeLimit}`;
  return rows;
}

async function getRecentActivities(limit = 50) {
  return prisma.activityLog.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { firstName: true, lastName: true, email: true } } },
  });
}

async function getLoginHistory({ userId, page, limit, skip, startDate, endDate, success }) {
  const where = {};
  if (userId) where.userId = userId;
  if (success !== undefined) {
    const s = typeof success === 'string' ? success : String(success);
    where.success = s === 'true';
  }
  if (startDate || endDate) where.createdAt = {
    ...(startDate && { gte: new Date(startDate) }),
    ...(endDate   && { lte: new Date(endDate) }),
  };
  const [data, total] = await Promise.all([
    prisma.loginHistory.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.loginHistory.count({ where }),
  ]);
  return { data, total };
}

async function getRegistrationHistory({ page, limit, skip, startDate, endDate }) {
  const where = {};
  if (startDate || endDate) where.createdAt = {
    ...(startDate && { gte: new Date(startDate) }),
    ...(endDate   && { lte: new Date(endDate) }),
  };
  const [data, total] = await Promise.all([
    prisma.registrationLog.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.registrationLog.count({ where }),
  ]);
  return { data, total };
}

async function getActivityHistory({ userId, action, page, limit, skip, startDate, endDate }) {
  const where = {};
  if (userId) where.userId = userId;
  if (action) where.action = action;
  if (startDate || endDate) where.createdAt = {
    ...(startDate && { gte: new Date(startDate) }),
    ...(endDate   && { lte: new Date(endDate) }),
  };
  const [data, total] = await Promise.all([
    prisma.activityLog.findMany({
      where, skip, take: limit, orderBy: { createdAt: 'desc' },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    }),
    prisma.activityLog.count({ where }),
  ]);
  return { data, total };
}

async function getSessionHistory({ userId, page, limit, skip, startDate, endDate, isActive }) {
  const where = {};
  if (userId) where.userId = userId;
  if (isActive !== undefined) {
    const a = typeof isActive === 'string' ? isActive : String(isActive);
    where.isActive = a === 'true';
  }
  if (startDate || endDate) where.loginAt = {
    ...(startDate && { gte: new Date(startDate) }),
    ...(endDate   && { lte: new Date(endDate) }),
  };
  const [data, total] = await Promise.all([
    prisma.userSession.findMany({ where, skip, take: limit, orderBy: { loginAt: 'desc' } }),
    prisma.userSession.count({ where }),
  ]);
  return { data, total };
}

module.exports = {
  track,
  getIp,
  trackRegistration,
  trackLogin,
  trackLogout,
  trackActivity,
  getSummary,
  getLoginGraph,
  getRegistrationTrend,
  getMostActiveUsers,
  getRecentActivities,
  getLoginHistory,
  getRegistrationHistory,
  getActivityHistory,
  getSessionHistory,
};
