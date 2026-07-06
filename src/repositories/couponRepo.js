'use strict';

const prisma = require('./prismaClient');

function toMongo(row) {
  if (!row) return null;
  const { id, ...rest } = row;
  return { ...rest, _id: id, id };
}

function toPrismaData(data) {
  const { _id, __v, ...rest } = data;
  return rest;
}

function toWhere(filter = {}) {
  const where = { isDeleted: false };
  for (const [k, v] of Object.entries(filter)) {
    if (k === '_id' || k === 'id') { where.id = v; continue; }
    where[k] = v;
  }
  return where;
}

class CouponRepository {
  async findById(id) {
    const row = await prisma.coupon.findUnique({ where: { id } });
    return toMongo(row);
  }

  async findOne(filter) {
    const row = await prisma.coupon.findFirst({ where: toWhere(filter) });
    return toMongo(row);
  }

  async findAll(filter = {}, options = {}) {
    const { sort = { createdAt: -1 }, skip = 0, limit = 20 } = options;
    const rows = await prisma.coupon.findMany({
      where: toWhere(filter),
      orderBy: toOrderBy(sort),
      skip,
      take: limit,
    });
    return rows.map(toMongo);
  }

  async count(filter = {}) {
    return prisma.coupon.count({ where: toWhere(filter) });
  }

  async create(data) {
    const row = await prisma.coupon.create({ data: toPrismaData(data) });
    return toMongo(row);
  }

  async updateById(id, data) {
    const row = await prisma.coupon.update({ where: { id }, data: toPrismaData(data) });
    return toMongo(row);
  }

  async deleteById(id) {
    const row = await prisma.coupon.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
    return toMongo(row);
  }

  async findByCode(code) {
    const row = await prisma.coupon.findFirst({
      where: { code: code.toUpperCase(), isDeleted: false },
    });
    return toMongo(row);
  }

  async markUsed(couponId, userId) {
    const coupon = await prisma.coupon.findUnique({ where: { id: couponId }, select: { usedBy: true, totalUsed: true } });
    if (!coupon) return null;
    const row = await prisma.coupon.update({
      where: { id: couponId },
      data: {
        totalUsed: { increment: 1 },
        usedBy: { set: [...coupon.usedBy, userId] },
      },
    });
    return toMongo(row);
  }
}

function toOrderBy(sort) {
  if (!sort) return [{ createdAt: 'desc' }];
  if (typeof sort === 'string') {
    const field = sort.startsWith('-') ? sort.slice(1) : sort;
    return [{ [field]: sort.startsWith('-') ? 'desc' : 'asc' }];
  }
  return Object.entries(sort).map(([k, v]) => ({ [k]: v === -1 || v === 'desc' ? 'desc' : 'asc' }));
}

module.exports = new CouponRepository();
