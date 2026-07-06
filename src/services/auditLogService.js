'use strict';

const { auditLogRepo } = require('../repositories');
const { buildPaginationMeta } = require('../helpers/paginate');

class AuditLogService {
  async log({ userId, role, action, entity, entityId, before = null, req = null }) {
    return auditLogRepo.create({
      userId:    userId   ?? null,
      role:      role     ?? null,
      action,
      entity:    entity   ?? null,
      entityId:  entityId ?? null,
      before,
      ipAddress: req?.ip ?? null,
      userAgent: req?.headers?.['user-agent'] ?? null,
    });
  }

  async getLogs(queryParams) {
    const page  = Math.max(parseInt(queryParams.page)  || 1, 1);
    const limit = Math.min(parseInt(queryParams.limit) || 50, 200);
    const skip  = (page - 1) * limit;

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
