'use strict';

const prisma = require('./prismaClient');
const { toOrderBy, softDeleteData } = require('./repoUtils');

const AUTHOR_INCLUDE = {
  author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, avatarPublicId: true } },
};

function toMongo(row) {
  if (!row) return null;
  const { id, coverImageUrl, coverImagePublicId, coverImageAlt, author, authorId, ...rest } = row;
  return {
    ...rest,
    _id: id, id, authorId,
    coverImage: coverImageUrl
      ? { url: coverImageUrl, publicId: coverImagePublicId ?? null, alt: coverImageAlt ?? null }
      : undefined,
    ...(author ? { author: toMongoAuthor(author) } : {}),
  };
}

function toMongoAuthor(a) {
  if (!a) return null;
  const { id, avatarUrl, avatarPublicId, ...rest } = a;
  return { ...rest, _id: id, id, avatar: avatarUrl ? { url: avatarUrl, publicId: avatarPublicId ?? null } : undefined };
}

function toPrismaData(data) {
  const { coverImage, author, _id, __v, ...rest } = data;
  const out = { ...rest };
  if (coverImage !== undefined) {
    out.coverImageUrl      = coverImage?.url      ?? null;
    out.coverImagePublicId = coverImage?.publicId ?? null;
    out.coverImageAlt      = coverImage?.alt      ?? null;
  }
  if (author !== undefined) out.authorId = author;
  return out;
}

const FIELD_MAP = {
  coverImage: ['coverImageUrl', 'coverImagePublicId', 'coverImageAlt'],
  author: null,
  _id:    'id',
};

function toSelect(selectStr) {
  if (!selectStr) return undefined;
  const select = { id: true };
  for (const f of selectStr.split(/\s+/)) {
    const mapped = FIELD_MAP[f];
    if (mapped === null) continue;
    if (Array.isArray(mapped)) mapped.forEach((col) => { select[col] = true; });
    else if (mapped) select[mapped] = true;
    else select[f] = true;
  }
  return select;
}

function toInclude(populate = []) {
  if (!populate.length) return undefined;
  const include = {};
  for (const p of populate) {
    if ((typeof p === 'string' ? p : p.path) === 'author') include.author = AUTHOR_INCLUDE.author;
  }
  return Object.keys(include).length ? include : undefined;
}

function toWhere(filter = {}) {
  const where = { isDeleted: false };
  for (const [k, v] of Object.entries(filter)) {
    if (k === '_id' || k === 'id') { where.id       = v; continue; }
    if (k === 'author')            { where.authorId = v; continue; }
    where[k] = v;
  }
  return where;
}

class BlogRepository {
  async findById(id, options = {}) {
    const include = toInclude(options.populate || []);
    return toMongo(await prisma.blog.findUnique({ where: { id }, ...(include ? { include } : {}) }));
  }

  async findOne(filter) {
    return toMongo(await prisma.blog.findFirst({ where: toWhere(filter) }));
  }

  async findAll(filter = {}, options = {}) {
    const { sort = { createdAt: -1 }, skip = 0, limit = 20, populate = [], select } = options;
    const include = toInclude(populate);

    let query;
    if (include && select) {
      query = { select: { ...toSelect(select), ...include } };
    } else if (include) {
      query = { include };
    } else if (select) {
      query = { select: toSelect(select) };
    } else {
      query = {};
    }

    const rows = await prisma.blog.findMany({ where: toWhere(filter), orderBy: toOrderBy(sort), skip, take: limit, ...query });
    return rows.map(toMongo);
  }

  async count(filter = {}) {
    return prisma.blog.count({ where: toWhere(filter) });
  }

  async create(data) {
    return toMongo(await prisma.blog.create({ data: toPrismaData(data) }));
  }

  async updateById(id, data) {
    return toMongo(await prisma.blog.update({ where: { id }, data: toPrismaData(data) }));
  }

  async deleteById(id) {
    return toMongo(await prisma.blog.update({ where: { id }, data: softDeleteData }));
  }

  async findPublished(filter = {}, options = {}) {
    return this.findAll({ ...filter, status: 'published' }, options);
  }

  async findBySlug(slug) {
    return toMongo(await prisma.blog.findFirst({ where: { slug, status: 'published', isDeleted: false }, include: AUTHOR_INCLUDE }));
  }

  async findBySlugAdmin(slug) {
    return toMongo(await prisma.blog.findFirst({ where: { slug, isDeleted: false }, include: AUTHOR_INCLUDE }));
  }

  async incrementViews(id) {
    return prisma.blog.update({ where: { id }, data: { views: { increment: 1 } } });
  }

  async toggleLike(id, increment = true) {
    return toMongo(await prisma.blog.update({ where: { id }, data: { likes: { increment: increment ? 1 : -1 } } }));
  }

  async search(query, filter = {}, skip = 0, limit = 20) {
    const where = { ...toWhere(filter), status: 'published' };
    if (query) {
      where.OR = [
        { title:   { contains: query, mode: 'insensitive' } },
        { content: { contains: query, mode: 'insensitive' } },
        { excerpt: { contains: query, mode: 'insensitive' } },
        { tags:    { has: query.toLowerCase() } },
      ];
    }
    const rows = await prisma.blog.findMany({ where, orderBy: { publishedAt: 'desc' }, skip, take: limit, include: AUTHOR_INCLUDE });
    return rows.map(toMongo);
  }

  async buildFilter(query) {
    const filter = {};
    if (query.category)          filter.category  = { contains: query.category, mode: 'insensitive' };
    if (query.tags)              filter.tags       = { hasSome: query.tags.split(',').map((t) => t.trim().toLowerCase()) };
    if (query.author)            filter.authorId   = query.author;
    if (query.isFeatured === 'true') filter.isFeatured = true;
    return filter;
  }
}

module.exports = new BlogRepository();
