'use strict';

const prisma = require('./prismaClient');
const { toOrderBy, softDeleteData } = require('./repoUtils');

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
    where[k === '_id' || k === 'id' ? 'id' : k] = v;
  }
  return where;
}

class CouponRepository {
  async findById(id) {
    return toMongo(await prisma.coupon.findUnique({ where: { id } }));
  }

  async findOne(filter) {
    return toMongo(await prisma.coupon.findFirst({ where: toWhere(filter) }));
  }

  async findAll(filter = {}, options = {}) {
    const { sort = { createdAt: -1 }, skip = 0, limit = 20 } = options;
    const rows = await prisma.coupon.findMany({ where: toWhere(filter), orderBy: toOrderBy(sort), skip, take: limit });
    return rows.map(toMongo);
  }

  async count(filter = {}) {
    return prisma.coupon.count({ where: toWhere(filter) });
  }

  async create(data) {
    return toMongo(await prisma.coupon.create({ data: toPrismaData(data) }));
  }

  async updateById(id, data) {
    return toMongo(await prisma.coupon.update({ where: { id }, data: toPrismaData(data) }));
  }

  async deleteById(id) {
    return toMongo(await prisma.coupon.update({ where: { id }, data: softDeleteData }));
  }

  async findByCode(code) {
    return toMongo(await prisma.coupon.findFirst({ where: { code: code.toUpperCase(), isDeleted: false } }));
  }

  // Single atomic update using Prisma push — no prior read needed
  async markUsed(couponId, userId) {
    try {
      return toMongo(await prisma.coupon.update({
        where: { id: couponId },
        data: { totalUsed: { increment: 1 }, usedBy: { push: userId } },
      }));
    } catch {
      return null;
    }
  }
}

module.exports = new CouponRepository();
