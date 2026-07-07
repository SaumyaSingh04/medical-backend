'use strict';

const auditLogService = require('../services/auditLogService');
const prisma = require('../repositories/prismaClient');
const logger = require('../utils/logger');
const { getIp } = require('../services/analyticsService');

// Entities where we capture a before-snapshot for a meaningful diff.
// Add entries here as new auditable entities are introduced.
const SNAPSHOT_FETCHERS = {
  User: (id) => prisma.user.findUnique({
    where:  { id },
    select: { id: true, role: true, isActive: true },
  }),
};

async function fetchSnapshot(entity, id) {
  if (!id || !SNAPSHOT_FETCHERS[entity]) return null;
  try {
    return await SNAPSHOT_FETCHERS[entity](id);
  } catch (err) {
    logger.warn('auditLog: snapshot fetch failed', { entity, id, error: err.message });
    return null;
  }
}

/**
 * Audit log middleware — fires after response, never blocks the request.
 * Only records successful mutations (2xx). Stores minimal context.
 *
 * Usage:
 *   router.patch('/:id/role', auditLog('update_role', 'User'), ctrl.updateUserRole);
 */
const auditLog = (action, entity) => async (req, res, next) => {
  const before = await fetchSnapshot(entity, req.params?.id);

  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;

    auditLogService.log({
      userId:    req.user?.id   ?? null,
      role:      req.user?.role ?? null,
      action,
      entity,
      entityId:  req.params?.id ?? null,
      before,
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'] ?? null,
      requestId: req.requestId ?? null,
    }).catch((err) => {
      logger.warn('auditLog: write failed', { action, entity, error: err.message });
    });
  });

  next();
};

module.exports = { auditLog };
