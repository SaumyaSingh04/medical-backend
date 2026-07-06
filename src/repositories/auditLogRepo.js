'use strict';

const prisma = require('./prismaClient');

class AuditLogRepository {
  async create(data) {
    return prisma.auditLog.create({ data });
  }

  async findAll({ userId, entity, entityId, action, from, to } = {}, { skip = 0, limit = 50 } = {}) {
    const where = {};
    if (userId)   where.userId   = userId;
    if (entity)   where.entity   = entity;
    if (entityId) where.entityId = entityId;
    if (action)   where.action   = { contains: action, mode: 'insensitive' };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to)   where.createdAt.lte = new Date(to + 'T23:59:59.999Z');
    }
    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);
    return { rows, total };
  }
}

module.exports = new AuditLogRepository();
