'use strict';

const prisma = require('./prismaClient');
const { toOrderBy, softDeleteData } = require('./repoUtils');

function toMongo(row) {
  if (!row) return null;
  const { id, imageUrl, imagePublicId, parentId, ...rest } = row;
  return {
    ...rest,
    _id: id, id,
    image:  imageUrl ? { url: imageUrl, publicId: imagePublicId ?? null } : undefined,
    parent: parentId ?? null,
  };
}

function toPrismaData(data) {
  const { image, parent, _id, __v, ...rest } = data;
  const out = { ...rest };
  if (image   !== undefined) { out.imageUrl = image?.url ?? null; out.imagePublicId = image?.publicId ?? null; }
  if (parent  !== undefined) out.parentId = parent ?? null;
  return out;
}

function toWhere(filter = {}) {
  const where = { isDeleted: false };
  for (const [k, v] of Object.entries(filter)) {
    if (k === '_id' || k === 'id') { where.id        = v; continue; }
    if (k === 'parent')            { where.parentId  = v ?? null; continue; }
    if (k === 'ancestors')         { where.ancestors = { has: v }; continue; }
    where[k] = v;
  }
  return where;
}

class CategoryRepository {
  async findById(id) {
    return toMongo(await prisma.category.findUnique({ where: { id } }));
  }

  async findOne(filter) {
    return toMongo(await prisma.category.findFirst({ where: toWhere(filter) }));
  }

  async findAll(filter = {}, options = {}) {
    const { sort = { createdAt: -1 }, skip = 0, limit = 20 } = options;
    const rows = await prisma.category.findMany({ where: toWhere(filter), orderBy: toOrderBy(sort), skip, take: limit });
    return rows.map(toMongo);
  }

  async count(filter = {}) {
    return prisma.category.count({ where: toWhere(filter) });
  }

  async create(data) {
    return toMongo(await prisma.category.create({ data: toPrismaData(data) }));
  }

  async updateById(id, data) {
    return toMongo(await prisma.category.update({ where: { id }, data: toPrismaData(data) }));
  }

  async deleteById(id) {
    return toMongo(await prisma.category.update({ where: { id }, data: softDeleteData }));
  }

  async exists(filter) {
    return (await prisma.category.count({ where: toWhere(filter) })) > 0;
  }

  async findRoots() {
    const rows = await prisma.category.findMany({ where: { parentId: null, isActive: true, isDeleted: false }, orderBy: { sortOrder: 'asc' } });
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
