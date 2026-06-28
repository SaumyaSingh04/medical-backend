'use strict';

const prisma = require('../repositories/prismaClient');
const { UAParser } = require('ua-parser-js');

// ─── UA Parser helper ──────────────────────────────────────────────────────────
function parseUA(userAgent = '') {
  const parser = new UAParser(userAgent);
  const r = parser.getResult();
  return {
    device: r.device.type || 'desktop',
    browser: r.browser.name || 'Unknown',
    os: r.os.name || 'Unknown',
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

function detectSource(req) {
  const ua = req.headers['user-agent'] || '';
  if (!ua || ua.includes('axios') || ua.includes('curl') || ua.includes('PostmanRuntime')) return 'api';
  if (/mobile|android|iphone|ipad/i.test(ua)) return 'mobile';
  return 'web';
}

// ─── Fire-and-forget wrapper ──────────────────────────────────────────────────
function track(fn) {
  Promise.resolve(fn()).catch(() => {});
}

// ─── Registration tracking ────────────────────────────────────────────────────
async function trackRegistration(req, userId, email) {
  const ua = parseUA(req.headers['user-agent']);
  await prisma.registrationLog.create({
    data: {
      userId,
      email,
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
      device: ua.device,
      browser: ua.browser,
      os: ua.os,
      source: detectSource(req),
    },
  });
}

// ─── Login tracking ───────────────────────────────────────────────────────────
async function trackLogin(req, { userId, email, success, failReason, sessionToken }) {
  const ua = parseUA(req.headers['user-agent']);
  const record = await prisma.loginHistory.create({
    data: {
      userId: success ? userId : (userId || null),
      email,
      success,
      failReason: failReason || null,
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
      device: ua.device,
      browser: ua.browser,
      os: ua.os,
    },
  });

  if (success && sessionToken) {
    const session = await prisma.userSession.create({
      data: {
        userId,
        sessionToken,
        ipAddress: getIp(req),
        userAgent: req.headers['user-agent'],
        device: ua.device,
        browser: ua.browser,
        os: ua.os,
      },
    });
    await prisma.loginHistory.update({
      where: { id: record.id },
      data: { sessionId: session.id },
    });
    return session.id;
  }
  return null;
}

// ─── Logout tracking ──────────────────────────────────────────────────────────
async function trackLogout(userId, sessionId) {
  if (!sessionId) {
    // close the most recent active session for this user
    const session = await prisma.userSession.findFirst({
      where: { userId, isActive: true },
      orderBy: { loginAt: 'desc' },
    });
    if (!session) return;
    sessionId = session.id;
  }
  const session = await prisma.userSession.findUnique({ where: { id: sessionId } });
  if (!session) return;
  const duration = Math.floor((Date.now() - session.loginAt.getTime()) / 1000);
  await prisma.userSession.update({
    where: { id: sessionId },
    data: { isActive: false, logoutAt: new Date(), durationSeconds: duration },
  });
}

// ─── Activity log ─────────────────────────────────────────────────────────────
async function trackActivity(req, res, action) {
  await prisma.activityLog.create({
    data: {
      userId: req.user?.id || null,
      action,
      method: req.method,
      endpoint: req.originalUrl?.split('?')[0],
      statusCode: res.statusCode,
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
      meta: req.analyticsMeta || null,
    },
  });
}

// ─── Analytics queries ────────────────────────────────────────────────────────

async function getSummary() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart); weekStart.setDate(todayStart.getDate() - 6);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalUsers,
    newToday,
    newWeek,
    newMonth,
    activeToday,
    totalLogins,
    successLogins,
    failedLogins,
    currentlyActive,
    avgDuration,
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
    newUsersToday: newToday,
    newUsersThisWeek: newWeek,
    newUsersThisMonth: newMonth,
    activeUsersToday: activeToday,
    totalLogins,
    successfulLogins: successLogins,
    failedLogins,
    currentlyActiveUsers: currentlyActive,
    avgSessionDurationSeconds: Math.round(avgDuration._avg.durationSeconds || 0),
  };
}

async function getLoginGraph(period = 'daily') {
  let startDate, groupBy;
  const now = new Date();

  if (period === 'weekly') {
    startDate = new Date(now); startDate.setDate(now.getDate() - 6 * 7);
    groupBy = "DATE_TRUNC('week', \"createdAt\")";
  } else if (period === 'monthly') {
    startDate = new Date(now); startDate.setFullYear(now.getFullYear() - 1);
    groupBy = "DATE_TRUNC('month', \"createdAt\")";
  } else {
    startDate = new Date(now); startDate.setDate(now.getDate() - 29);
    groupBy = "DATE_TRUNC('day', \"createdAt\")";
  }

  const rows = await prisma.$queryRawUnsafe(`
    SELECT ${groupBy} as period,
           COUNT(*) as total,
           SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successful,
           SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as failed
    FROM "LoginHistory"
    WHERE "createdAt" >= $1
    GROUP BY 1 ORDER BY 1`, startDate);

  return rows.map(r => ({
    period: r.period,
    total: Number(r.total),
    successful: Number(r.successful),
    failed: Number(r.failed),
  }));
}

async function getRegistrationTrend(days = 30) {
  const startDate = new Date(); startDate.setDate(startDate.getDate() - (days - 1));
  const rows = await prisma.$queryRawUnsafe(`
    SELECT DATE_TRUNC('day', "createdAt") as day, COUNT(*) as count
    FROM "RegistrationLog"
    WHERE "createdAt" >= $1
    GROUP BY 1 ORDER BY 1`, startDate);
  return rows.map(r => ({ day: r.day, count: Number(r.count) }));
}

async function getMostActiveUsers(limit = 10) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT a."userId", u."firstName", u."lastName", u."email",
           COUNT(*) as actions
    FROM "ActivityLog" a
    LEFT JOIN "User" u ON u.id = a."userId"
    WHERE a."userId" IS NOT NULL
    GROUP BY a."userId", u."firstName", u."lastName", u."email"
    ORDER BY actions DESC
    LIMIT $1`, limit);
  return rows.map(r => ({ ...r, actions: Number(r.actions) }));
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
  if (success !== undefined) where.success = success === 'true' || success === true;
  if (startDate || endDate) where.createdAt = {
    ...(startDate && { gte: new Date(startDate) }),
    ...(endDate && { lte: new Date(endDate) }),
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
    ...(endDate && { lte: new Date(endDate) }),
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
    ...(endDate && { lte: new Date(endDate) }),
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
  if (isActive !== undefined) where.isActive = isActive === 'true' || isActive === true;
  if (startDate || endDate) where.loginAt = {
    ...(startDate && { gte: new Date(startDate) }),
    ...(endDate && { lte: new Date(endDate) }),
  };
  const [data, total] = await Promise.all([
    prisma.userSession.findMany({ where, skip, take: limit, orderBy: { loginAt: 'desc' } }),
    prisma.userSession.count({ where }),
  ]);
  return { data, total };
}

module.exports = {
  track,
  parseUA,
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
