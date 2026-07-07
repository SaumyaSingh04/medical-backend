'use strict';

const prisma = require('./prismaClient');
const categoryRepo = require('./categoryRepo');
const { toOrderBy, softDeleteData } = require('./repoUtils');

function toMongo(row) {
  if (!row) return null;
  const { id, thumbnailUrl, thumbnailPublicId, category, subcategory, ...rest } = row;
  return {
    ...rest,
    _id: id,
    id,
    thumbnail: thumbnailUrl ? { url: thumbnailUrl, publicId: thumbnailPublicId ?? null } : undefined,
    ...(category    ? { category:    toMongoCategory(category) }    : {}),
    ...(subcategory ? { subcategory: toMongoCategory(subcategory) } : {}),
    get variants() { return withId(rest.variants || []); },
  };
}

function toMongoCategory(c) {
  if (!c) return null;
  const { id, ...rest } = c;
  return { ...rest, _id: id, id };
}

function withId(arr) {
  const result = [...arr];
  result.id = (vid) => result.find((v) => v._id === vid || v.id === vid) ?? null;
  return result;
}

function toPrismaData(data) {
  const { thumbnail, _id, __v, category, subcategory, ...rest } = data;
  const out = { ...rest };
  if (thumbnail  !== undefined) { out.thumbnailUrl = thumbnail?.url ?? null; out.thumbnailPublicId = thumbnail?.publicId ?? null; }
  if (category   !== undefined) out.categoryId    = category    ?? null;
  if (subcategory !== undefined) out.subcategoryId = subcategory ?? null;
  return out;
}

function toWhere(filter = {}) {
  const where = { isDeleted: false };
  for (const [k, v] of Object.entries(filter)) {
    where[k === '_id' || k === 'id' ? 'id' : k] = v;
  }
  return where;
}

function toInclude(populate = []) {
  if (!populate.length) return undefined;
  const include = {};
  for (const p of populate) {
    const path = typeof p === 'string' ? p : p.path;
    if (path === 'category')    include.category    = { select: { id: true, name: true, slug: true } };
    if (path === 'subcategory') include.subcategory = { select: { id: true, name: true, slug: true } };
  }
  return Object.keys(include).length ? include : undefined;
}

// Shared helper: read variants Json[], apply delta fn, write back.
async function mutateVariantStock(productId, variantId, deltaFn, extraData = {}) {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { variants: true } });
  if (!product) return null;
  const variants = product.variants.map((v) =>
    (v._id === variantId || v.id === variantId) ? { ...v, stock: deltaFn(v.stock || 0) } : v
  );
  return prisma.product.update({ where: { id: productId }, data: { variants: { set: variants }, ...extraData } });
}

class ProductRepository {
  async findById(id, options = {}) {
    const include = toInclude(options.populate || []);
    return toMongo(await prisma.product.findUnique({ where: { id }, ...(include ? { include } : {}) }));
  }

  async findOne(filter, options = {}) {
    const include = toInclude(options.populate || []);
    return toMongo(await prisma.product.findFirst({ where: toWhere(filter), ...(include ? { include } : {}) }));
  }

  async findAll(filter = {}, options = {}) {
    const { sort = { createdAt: -1 }, skip = 0, limit = 20, populate = [] } = options;
    const include = toInclude(populate);
    const rows = await prisma.product.findMany({
      where: toWhere(filter), orderBy: toOrderBy(sort), skip, take: limit,
      ...(include ? { include } : {}),
    });
    return rows.map(toMongo);
  }

  async count(filter = {}) {
    return prisma.product.count({ where: toWhere(filter) });
  }

  async findManyByIds(ids) {
    const rows = await prisma.product.findMany({ where: { id: { in: ids }, isDeleted: false } });
    return rows.map(toMongo);
  }

  async create(data) {
    return toMongo(await prisma.product.create({ data: toPrismaData(data) }));
  }

  async updateById(id, data) {
    return toMongo(await prisma.product.update({ where: { id }, data: toPrismaData(data) }));
  }

  async deleteById(id) {
    return toMongo(await prisma.product.update({ where: { id }, data: softDeleteData }));
  }

  async buildFilter(queryParams) {
    const filter = {};

    // isActive: 'all' → no filter; undefined → default true; explicit value → parse
    if (queryParams.isActive !== 'all') {
      filter.isActive = queryParams.isActive !== undefined ? queryParams.isActive !== 'false' : true;
    }

    if (queryParams.subcategory) {
      filter.subcategoryId = queryParams.subcategory;
    } else if (queryParams.category) {
      const ids = (await categoryRepo.findWithDescendants(queryParams.category)).map((c) => c.id);
      filter.categoryId = { in: ids };
    }

    if (queryParams.brand)     filter.brand = { contains: queryParams.brand, mode: 'insensitive' };
    if (queryParams.minRating) filter.averageRating = { gte: Number(queryParams.minRating) };
    if (queryParams.inStock === 'true')    filter.stock      = { gt: 0 };
    if (queryParams.isFeatured === 'true') filter.isFeatured = true;
    if (queryParams.tags)      filter.tags = { hasSome: queryParams.tags.split(',').map((t) => t.trim()) };

    if (queryParams.minPrice || queryParams.maxPrice) {
      filter.price = {};
      if (queryParams.minPrice) filter.price.gte = Number(queryParams.minPrice);
      if (queryParams.maxPrice) filter.price.lte = Number(queryParams.maxPrice);
    }

    if (queryParams.q) {
      filter.OR = [
        { name:        { contains: queryParams.q, mode: 'insensitive' } },
        { description: { contains: queryParams.q, mode: 'insensitive' } },
        { brand:       { contains: queryParams.q, mode: 'insensitive' } },
      ];
    }

    return filter;
  }

  async decrementStock(productId, variantId, quantity) {
    if (!variantId) {
      return prisma.product.update({
        where: { id: productId },
        data: { stock: { decrement: quantity }, totalSold: { increment: quantity } },
      });
    }
    return mutateVariantStock(productId, variantId, (s) => s - quantity, { totalSold: { increment: quantity } });
  }

  async incrementStock(productId, variantId, quantity) {
    if (!variantId) {
      return prisma.product.update({ where: { id: productId }, data: { stock: { increment: quantity } } });
    }
    return mutateVariantStock(productId, variantId, (s) => s + quantity);
  }

  async removeImage(productId, publicId) {
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { images: true } });
    if (!product) return null;
    const images = (product.images || []).filter((img) => img.publicId !== publicId);
    return toMongo(await prisma.product.update({ where: { id: productId }, data: { images: { set: images } } }));
  }
}

module.exports = new ProductRepository();
