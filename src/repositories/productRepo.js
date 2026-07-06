'use strict';

const prisma = require('./prismaClient');
const categoryRepo = require('./categoryRepo');

// ─── Shape adapter ────────────────────────────────────────────────────────────
// Services access: product._id, product.price, product.name, product.slug,
// product.stock, product.images[], product.thumbnail?.url,
// product.variants (Json[]), product.category (populated)
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
    // Prisma stores images as Json[] — expose as-is; services treat them as [{ url, publicId }]
    // variants is Json[] — expose as-is; services call product.variants?.id(variantId)
    // which is a Mongoose subdoc method. We shim it below.
    get variants() { return withId(rest.variants || []); },
  };
}

function toMongoCategory(c) {
  if (!c) return null;
  const { id, ...rest } = c;
  return { ...rest, _id: id, id };
}

// Shim: add a `.id(variantId)` method on the variants array so Mongoose
// callers in services (product.variants.id(x)) keep working without changes.
function withId(arr) {
  const result = [...arr];
  result.id = (vid) => result.find((v) => v._id === vid || v.id === vid) ?? null;
  return result;
}

// ─── Input adapter ────────────────────────────────────────────────────────────
function toPrismaData(data) {
  const { thumbnail, _id, __v, category, subcategory, ...rest } = data;
  const out = { ...rest };
  if (thumbnail !== undefined) {
    out.thumbnailUrl       = thumbnail?.url ?? null;
    out.thumbnailPublicId  = thumbnail?.publicId ?? null;
  }
  // Validation sends 'category'/'subcategory' as UUIDs; Prisma schema needs 'categoryId'/'subcategoryId'
  if (category !== undefined)    out.categoryId    = category ?? null;
  if (subcategory !== undefined) out.subcategoryId = subcategory ?? null;
  return out;
}

// ─── Filter adapter ───────────────────────────────────────────────────────────
// Converts the subset of Mongoose filter shapes used by productService / adminService.
function toWhere(filter = {}) {
  const where = { isDeleted: false };
  for (const [k, v] of Object.entries(filter)) {
    if (k === '_id' || k === 'id') { where.id = v; continue; }
    where[k] = v;
  }
  return where;
}

function toOrderBy(sort) {
  if (!sort) return [{ createdAt: 'desc' }];
  if (typeof sort === 'string') {
    const field = sort.startsWith('-') ? sort.slice(1) : sort;
    return [{ [field]: sort.startsWith('-') ? 'desc' : 'asc' }];
  }
  // Skip Mongoose text-score sort — no equivalent in Prisma/PostgreSQL without tsvector
  return Object.entries(sort)
    .filter(([k]) => k !== 'score')
    .map(([k, v]) => ({ [k]: v === -1 || v === 'desc' ? 'desc' : 'asc' }));
}

// ─── Include builder ──────────────────────────────────────────────────────────
function toInclude(populate = []) {
  if (!populate.length) return undefined;
  const include = {};
  populate.forEach((p) => {
    const path = typeof p === 'string' ? p : p.path;
    if (path === 'category')    include.category    = { select: { id: true, name: true, slug: true } };
    if (path === 'subcategory') include.subcategory = { select: { id: true, name: true, slug: true } };
  });
  return Object.keys(include).length ? include : undefined;
}

// ─── ProductRepository ────────────────────────────────────────────────────────

class ProductRepository {
  async findById(id, options = {}) {
    const include = toInclude(options.populate || []);
    const row = await prisma.product.findUnique({
      where: { id },
      ...(include ? { include } : {}),
    });
    return toMongo(row);
  }

  async findOne(filter, options = {}) {
    const include = toInclude(options.populate || []);
    const row = await prisma.product.findFirst({
      where: toWhere(filter),
      ...(include ? { include } : {}),
    });
    return toMongo(row);
  }

  async findAll(filter = {}, options = {}) {
    const { sort = { createdAt: -1 }, skip = 0, limit = 20, populate = [] } = options;
    const include = toInclude(populate);
    const rows = await prisma.product.findMany({
      where: toWhere(filter),
      orderBy: toOrderBy(sort),
      skip,
      take: limit,
      ...(include ? { include } : {}),
    });
    return rows.map(toMongo);
  }

  async count(filter = {}) {
    return prisma.product.count({ where: toWhere(filter) });
  }

  async create(data) {
    const row = await prisma.product.create({ data: toPrismaData(data) });
    return toMongo(row);
  }

  async updateById(id, data) {
    const row = await prisma.product.update({ where: { id }, data: toPrismaData(data) });
    return toMongo(row);
  }

  async deleteById(id) {
    const row = await prisma.product.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
    return toMongo(row);
  }

  // ── Product-specific ──────────────────────────────────────────────────────

  async buildFilter(queryParams) {
    const filter = {};

    if (queryParams.isActive === 'all') {
      // no filter — show all products regardless of isActive
    } else if (queryParams.isActive !== undefined) {
      filter.isActive = queryParams.isActive !== 'false';
    } else {
      filter.isActive = true;
    }

    if (queryParams.subcategory) {
      filter.subcategoryId = queryParams.subcategory;
    } else if (queryParams.category) {
      const all = await categoryRepo.findWithDescendants(queryParams.category);
      const ids = all.map((c) => c.id);
      filter.categoryId = { in: ids };
    }
    if (queryParams.brand)       filter.brand = { contains: queryParams.brand, mode: 'insensitive' };

    if (queryParams.minPrice || queryParams.maxPrice) {
      filter.price = {};
      if (queryParams.minPrice) filter.price.gte = Number(queryParams.minPrice);
      if (queryParams.maxPrice) filter.price.lte = Number(queryParams.maxPrice);
    }

    if (queryParams.minRating)           filter.averageRating = { gte: Number(queryParams.minRating) };
    if (queryParams.inStock === 'true')  filter.stock = { gt: 0 };
    if (queryParams.isFeatured === 'true') filter.isFeatured = true;
    if (queryParams.tags)                filter.tags = { hasSome: queryParams.tags.split(',').map(t => t.trim()) };

    // full-text search across name / description / brand
    if (queryParams.q) {
      filter.OR = [
        { name:        { contains: queryParams.q, mode: 'insensitive' } },
        { description: { contains: queryParams.q, mode: 'insensitive' } },
        { brand:       { contains: queryParams.q, mode: 'insensitive' } },
      ];
    }

    return filter;
  }

  // Variants are stored as Json[]. Decrement stock in-place then update the row.
  async decrementStock(productId, variantId, quantity) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return null;

    if (variantId) {
      const variants = product.variants.map((v) => {
        if (v._id === variantId || v.id === variantId) {
          return { ...v, stock: (v.stock || 0) - quantity };
        }
        return v;
      });
      return prisma.product.update({
        where: { id: productId },
        data: { variants, totalSold: { increment: quantity } },
      });
    }

    return prisma.product.update({
      where: { id: productId },
      data: {
        stock:     { decrement: quantity },
        totalSold: { increment: quantity },
      },
    });
  }

  async incrementStock(productId, variantId, quantity) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return null;

    if (variantId) {
      const variants = product.variants.map((v) => {
        if (v._id === variantId || v.id === variantId) {
          return { ...v, stock: (v.stock || 0) + quantity };
        }
        return v;
      });
      return prisma.product.update({ where: { id: productId }, data: { variants } });
    }

    return prisma.product.update({
      where: { id: productId },
      data: { stock: { increment: quantity } },
    });
  }

  // productService.deleteProductImage — remove one image from the Json[] array
  async removeImage(productId, publicId) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return null;
    const images = (product.images || []).filter((img) => img.publicId !== publicId);
    const row = await prisma.product.update({ where: { id: productId }, data: { images } });
    return toMongo(row);
  }
}

module.exports = new ProductRepository();
