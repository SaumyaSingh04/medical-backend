'use strict';

const auditLogService = require('../services/auditLogService');
const prisma = require('../repositories/prismaClient');

// Entities where we capture a before-snapshot for meaningful diff
const SNAPSHOT_ENTITIES = ['User'];

async function fetchSnapshot(entity, id) {
  if (!id) return null;
  try {
    if (entity === 'User') {
      return prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true, isActive: true },
      });
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Audit log middleware — fires after response, never blocks the request.
 * Only logs successful mutations (2xx). Stores minimal context.
 *
 * Usage:
 *   router.patch('/:id/role', auditLog('update_role', 'User'), ctrl.updateUserRole);
 */
const auditLog = (action, entity) => async (req, res, next) => {
  const before = SNAPSHOT_ENTITIES.includes(entity) && req.params?.id
    ? await fetchSnapshot(entity, req.params.id)
    : null;

  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;

    auditLogService.log({
      userId:   req.user?.id   ?? null,
      role:     req.user?.role ?? null,
      action,
      entity,
      entityId: req.params?.id ?? null,
      before,
      req,
    }).catch(() => {});
  });

  next();
};

module.exports = { auditLog };
