'use strict';

const { auditLogRepo } = require('../repositories');
const { parsePagination, buildPaginationMeta } = require('../helpers/paginate');
const logger = require('../utils/logger');

class AuditLogService {
  async log({ userId, role, action, entity, entityId, before = null, ipAddress = null, userAgent = null, requestId = null }) {
    try {
      return await auditLogRepo.create({
        userId:    userId   ?? null,
        role:      role     ?? null,
        action,
        entity:    entity   ?? null,
        entityId:  entityId ?? null,
        before,
        ipAddress,
        userAgent,
        requestId,
      });
    } catch (err) {
      logger.warn('AuditLogService.log failed', { action, entity, entityId, error: err.message });
    }
  }

  async getLogs(queryParams) {
    const { page, limit, skip } = parsePagination(queryParams);
    const { rows, total } = await auditLogRepo.findAll(
      {
        userId:   queryParams.userId,
        entity:   queryParams.entity,
        entityId: queryParams.entityId,
        action:   queryParams.action,
        from:     queryParams.from,
        to:       queryParams.to,
      },
      { skip, limit }
    );
    return { logs: rows, meta: buildPaginationMeta(total, page, limit) };
  }
}

module.exports = new AuditLogService();
