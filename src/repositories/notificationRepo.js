'use strict';

const prisma = require('./prismaClient');

function toMongo(row) {
  if (!row) return null;
  const { id, userId, ...rest } = row;
  return { ...rest, _id: id, id, user: userId };
}

function toPrismaData(data) {
  const { _id, __v, user, ...rest } = data;
  const out = { ...rest };
  if (user !== undefined) out.userId = user;
  return out;
}

function toWhere(filter = {}) {
  const where = {};
  for (const [k, v] of Object.entries(filter)) {
    if (k === '_id' || k === 'id') { where.id = v; continue; }
    if (k === 'user')              { where.userId = v; continue; }
    where[k] = v;
  }
  return where;
}

class NotificationRepository {
  async findById(id) {
    const row = await prisma.notification.findUnique({ where: { id } });
    return toMongo(row);
  }

  async count(filter = {}) {
    return prisma.notification.count({ where: toWhere(filter) });
  }

  async create(data) {
    const row = await prisma.notification.create({ data: toPrismaData(data) });
    return toMongo(row);
  }

  async updateOne(filter, data) {
    const existing = await prisma.notification.findFirst({ where: toWhere(filter) });
    if (!existing) return null;
    const row = await prisma.notification.update({ where: { id: existing.id }, data });
    return toMongo(row);
  }

  async deleteOne(filter) {
    const existing = await prisma.notification.findFirst({ where: toWhere(filter) });
    if (!existing) return null;
    return prisma.notification.delete({ where: { id: existing.id } });
  }

  async findUserNotifications(userId, skip = 0, limit = 20, unreadOnly = false) {
    const rows = await prisma.notification.findMany({
      where: unreadOnly ? { userId, isRead: false } : { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });
    return rows.map(toMongo);
  }

  async markAllRead(userId) {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async unreadCount(userId) {
    return prisma.notification.count({ where: { userId, isRead: false } });
  }

  async deleteAll(userId) {
    return prisma.notification.deleteMany({ where: { userId } });
  }

  async createMany(records) {
    return prisma.notification.createMany({ data: records, skipDuplicates: true });
  }

  async getActiveUserIds() {
    const users = await prisma.user.findMany({ where: { isActive: true }, select: { id: true } });
    return users.map((u) => u.id);
  }
}

module.exports = new NotificationRepository();
