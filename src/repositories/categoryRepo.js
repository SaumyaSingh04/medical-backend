'use strict';

const prisma = require('./prismaClient');

function toMongo(row) {
  if (!row) return null;
  const { id, imageUrl, imagePublicId, parentId, ...rest } = row;
  return {
    ...rest,
    _id: id,
    id,
    image: imageUrl ? { url: imageUrl, publicId: imagePublicId ?? null } : undefined,
    parent: parentId ?? null,
  };
}

function toPrismaData(data) {
  const { image, parent, _id, __v, ...rest } = data;
  const out = { ...rest };
  if (image !== undefined) {
    out.imageUrl = image?.url ?? null;
    out.imagePublicId = image?.publicId ?? null;
  }
  if (parent !== undefined) out.parentId = parent ?? null;
  return out;
}

function toOrderBy(sort) {
  if (!sort) return [{ createdAt: 'desc' }];
  if (typeof sort === 'string') {
    const field = sort.startsWith('-') ? sort.slice(1) : sort;
    return [{ [field]: sort.startsWith('-') ? 'desc' : 'asc' }];
  }
  return Object.entries(sort).map(([k, v]) => ({ [k]: v === -1 || v === 'desc' ? 'desc' : 'asc' }));
}

function toWhere(filter = {}) {
  const where = { isDeleted: false };
  for (const [k, v] of Object.entries(filter)) {
    if (k === '_id' || k === 'id') { where.id = v; continue; }
    if (k === 'parent')            { where.parentId = v ?? null; continue; }
    if (k === 'ancestors')         { where.ancestors = { has: v }; continue; }
    where[k] = v;
  }
  return where;
}

class CategoryRepository {
  async findById(id) {
    const row = await prisma.category.findUnique({ where: { id } });
    return toMongo(row);
  }

  async findOne(filter) {
    const row = await prisma.category.findFirst({ where: toWhere(filter) });
    return toMongo(row);
  }

  async findAll(filter = {}, options = {}) {
    const { sort = { createdAt: -1 }, skip = 0, limit = 20 } = options;
    const rows = await prisma.category.findMany({
      where: toWhere(filter),
      orderBy: toOrderBy(sort),
      skip,
      take: limit,
    });
    return rows.map(toMongo);
  }

  async count(filter = {}) {
    return prisma.category.count({ where: toWhere(filter) });
  }

  async create(data) {
    const row = await prisma.category.create({ data: toPrismaData(data) });
    return toMongo(row);
  }

  async updateById(id, data) {
    const row = await prisma.category.update({ where: { id }, data: toPrismaData(data) });
    return toMongo(row);
  }

  async deleteById(id) {
    const row = await prisma.category.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
    return toMongo(row);
  }

  async exists(filter) {
    const count = await prisma.category.count({ where: toWhere(filter) });
    return count > 0;
  }

  async findRoots() {
    const rows = await prisma.category.findMany({
      where: { parentId: null, isActive: true, isDeleted: false },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map(toMongo);
  }

  async findChildren(parentId) {
    const rows = await prisma.category.findMany({ where: { parentId, isActive: true, isDeleted: false } });
    return rows.map(toMongo);
  }

  async findWithDescendants(categoryId) {
    const rows = await prisma.category.findMany({
      where: { isDeleted: false, OR: [{ id: categoryId }, { ancestors: { has: categoryId } }] },
    });
    return rows.map(toMongo);
  }
}

module.exports = new CategoryRepository();
