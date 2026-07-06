'use strict';

const prisma = require('./prismaClient');

// ─── Shape adapter ────────────────────────────────────────────────────────────
// Shape adapter — services access blog._id, blog.coverImage?.publicId, blog.status, blog.slug
function toMongo(row) {
  if (!row) return null;
  const { id, coverImageUrl, coverImagePublicId, coverImageAlt, author, authorId, ...rest } = row;
  return {
    ...rest,
    _id: id,
    id,
    authorId,
    coverImage: coverImageUrl
      ? { url: coverImageUrl, publicId: coverImagePublicId ?? null, alt: coverImageAlt ?? null }
      : undefined,
    // If author was joined (populate equivalent), shape it like Mongoose populate result
    ...(author ? { author: toMongoAuthor(author) } : {}),
  };
}

function toMongoAuthor(a) {
  if (!a) return null;
  const { id, avatarUrl, avatarPublicId, ...rest } = a;
  return {
    ...rest,
    _id: id,
    id,
    // Service reads author.firstName, author.lastName, author.avatar
    avatar: avatarUrl ? { url: avatarUrl, publicId: avatarPublicId ?? null } : undefined,
  };
}

function toMongoMany(rows) {
  return rows.map(toMongo);
}

// ─── Input adapter ────────────────────────────────────────────────────────────
// Service passes { coverImage: { url, publicId, alt }, author: userId, status, ... }
function toPrismaData(data) {
  const { coverImage, author, _id, __v, ...rest } = data;
  const out = { ...rest };
  if (coverImage !== undefined) {
    out.coverImageUrl      = coverImage?.url ?? null;
    out.coverImagePublicId = coverImage?.publicId ?? null;
    out.coverImageAlt      = coverImage?.alt ?? null;
  }
  // Service sets data.author = userId (ObjectId string)
  if (author !== undefined) out.authorId = author;
  return out;
}

// ─── Sort adapter ─────────────────────────────────────────────────────────────
function toOrderBy(sort) {
  if (!sort) return [{ createdAt: 'desc' }];
  if (typeof sort === 'string') {
    const field = sort.startsWith('-') ? sort.slice(1) : sort;
    return [{ [field]: sort.startsWith('-') ? 'desc' : 'asc' }];
  }
  return Object.entries(sort).map(([k, v]) => ({
    [k]: v === -1 || v === 'desc' ? 'desc' : 'asc',
  }));
}

// ─── Select adapter ───────────────────────────────────────────────────────────
// Service passes Mongoose-style select strings like:
//   'title slug excerpt coverImage author category tags publishedAt views likes isFeatured'
// Map recognised field names; unknown fields are dropped silently.
const FIELD_MAP = {
  coverImage: ['coverImageUrl', 'coverImagePublicId', 'coverImageAlt'],
  author:     null,   // handled via include, not select
  _id:        'id',
};

function toSelect(selectStr) {
  if (!selectStr) return undefined;
  const select = { id: true };   // always include id
  selectStr.split(/\s+/).forEach((f) => {
    const mapped = FIELD_MAP[f];
    if (mapped === null) return;           // join field — skip, handled by include
    if (Array.isArray(mapped)) {
      mapped.forEach((col) => { select[col] = true; });
    } else if (mapped) {
      select[mapped] = true;
    } else {
      select[f] = true;                    // pass through unchanged
    }
  });
  return select;
}

// ─── Include builder ──────────────────────────────────────────────────────────
// Mongoose populate: [{ path: 'author', select: 'firstName lastName avatar' }]
// Prisma include:    { author: { select: { id, firstName, lastName, avatarUrl, avatarPublicId } } }
function toInclude(populate = []) {
  if (!populate.length) return undefined;
  const include = {};
  populate.forEach((p) => {
    const path = typeof p === 'string' ? p : p.path;
    if (path === 'author') {
      include.author = {
        select: { id: true, firstName: true, lastName: true, avatarUrl: true, avatarPublicId: true },
      };
    }
  });
  return Object.keys(include).length ? include : undefined;
}

// ─── BlogRepository ───────────────────────────────────────────────────────────

class BlogRepository {
  async findById(id, options = {}) {
    const { populate = [] } = options;
    const include = toInclude(populate);
    const row = await prisma.blog.findUnique({
      where: { id },
      ...(include ? { include } : {}),
    });
    return toMongo(row);
  }

  async findOne(filter) {
    const row = await prisma.blog.findFirst({ where: toWhere(filter) });
    return toMongo(row);
  }

  async findAll(filter = {}, options = {}) {
    const { sort = { createdAt: -1 }, skip = 0, limit = 20, populate = [], select } = options;
    const include = toInclude(populate);

    // Prisma cannot use include and select simultaneously.
    // When populate (include) is requested, merge selected scalar fields into the include block.
    let query;
    if (include && select) {
      const scalarSelect = toSelect(select);
      // Merge scalar selections into include so author sub-select is preserved
      query = {
        select: {
          ...scalarSelect,
          ...include, // spreads e.g. { author: { select: {...} } }
        },
      };
    } else if (include) {
      query = { include };
    } else if (select) {
      query = { select: toSelect(select) };
    } else {
      query = {};
    }

    const rows = await prisma.blog.findMany({
      where: toWhere(filter),
      orderBy: toOrderBy(sort),
      skip,
      take: limit,
      ...query,
    });
    return toMongoMany(rows);
  }

  async count(filter = {}) {
    return prisma.blog.count({ where: toWhere(filter) });
  }

  async create(data) {
    const row = await prisma.blog.create({ data: toPrismaData(data) });
    return toMongo(row);
  }

  async updateById(id, data) {
    const row = await prisma.blog.update({
      where: { id },
      data: toPrismaData(data),
    });
    return toMongo(row);
  }

  async deleteById(id) {
    const row = await prisma.blog.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
    return toMongo(row);
  }

  async findPublished(filter = {}, options = {}) {
    return this.findAll({ ...filter, status: 'published' }, options);
  }

  async findBySlug(slug) {
    const row = await prisma.blog.findFirst({
      where: { slug, status: 'published', isDeleted: false },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, avatarPublicId: true } },
      },
    });
    return toMongo(row);
  }

  async findBySlugAdmin(slug) {
    const row = await prisma.blog.findFirst({
      where: { slug, isDeleted: false },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, avatarPublicId: true } },
      },
    });
    return toMongo(row);
  }

  async incrementViews(id) {
    return prisma.blog.update({
      where: { id },
      data: { views: { increment: 1 } },
    });
  }

  async toggleLike(id, increment = true) {
    const row = await prisma.blog.update({
      where: { id },
      data: { likes: { increment: increment ? 1 : -1 } },
    });
    return toMongo(row);
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
    const rows = await prisma.blog.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip,
      take: limit,
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, avatarPublicId: true } },
      },
    });
    return toMongoMany(rows);
  }

  async buildFilter(query) {
    const filter = {};
    if (query.category) filter.category = { contains: query.category, mode: 'insensitive' };
    if (query.tags)     filter.tags = { hasSome: query.tags.split(',').map((t) => t.trim().toLowerCase()) };
    if (query.author)   filter.authorId = query.author;
    if (query.isFeatured === 'true') filter.isFeatured = true;
    return filter;
  }
}

function toWhere(filter = {}) {
  const where = { isDeleted: false };
  for (const [k, v] of Object.entries(filter)) {
    if (k === '_id' || k === 'id') { where.id = v; continue; }
    if (k === 'author')            { where.authorId = v; continue; }
    if (k === 'status')            { where.status = v; continue; }
    if (k === 'category' || k === 'tags' || k === 'authorId' || k === 'isFeatured') {
      where[k] = v; continue;
    }
    where[k] = v;
  }
  return where;
}

module.exports = new BlogRepository();
