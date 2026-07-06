'use strict';

const prisma = require('./prismaClient');

function toMongo(row) {
  if (!row) return null;
  const { id, productId, userId, orderId, replyMessage, replyRepliedAt, replyRepliedById, ...rest } = row;
  return {
    ...rest,
    _id: id,
    id,
    product: productId,
    user: userId,
    order: orderId ?? null,
    reply: replyMessage ? { message: replyMessage, repliedAt: replyRepliedAt, repliedBy: replyRepliedById } : null,
  };
}

function toPrismaData(data) {
  const { _id, __v, product, user, order, reply, ...rest } = data;
  const out = { ...rest };
  if (product !== undefined) out.productId = product;
  if (user !== undefined)    out.userId    = user;
  if (order !== undefined)   out.orderId   = order ?? null;
  if (reply !== undefined) {
    out.replyMessage     = reply?.message ?? null;
    out.replyRepliedAt   = reply?.repliedAt ?? null;
    out.replyRepliedById = reply?.repliedBy ?? null;
  }
  return out;
}

function toWhere(filter = {}) {
  const where = {};
  for (const [k, v] of Object.entries(filter)) {
    if (k === '_id' || k === 'id') { where.id = v; continue; }
    if (k === 'product')           { where.productId = v; continue; }
    if (k === 'user')              { where.userId = v; continue; }
    if (k === 'order')             { where.orderId = v; continue; }
    where[k] = v;
  }
  return where;
}

class ReviewRepository {
  async findById(id) {
    const row = await prisma.review.findUnique({ where: { id } });
    return toMongo(row);
  }

  async findOne(filter) {
    const row = await prisma.review.findFirst({ where: toWhere(filter) });
    return toMongo(row);
  }

  async count(filter = {}) {
    return prisma.review.count({ where: toWhere(filter) });
  }

  async create(data) {
    const row = await prisma.review.create({ data: toPrismaData(data) });
    return toMongo(row);
  }

  async updateById(id, data) {
    const row = await prisma.review.update({ where: { id }, data: toPrismaData(data) });
    return toMongo(row);
  }

  async deleteById(id) {
    const row = await prisma.review.delete({ where: { id } });
    return toMongo(row);
  }

  async deleteOne(filter) {
    const existing = await prisma.review.findFirst({ where: toWhere(filter) });
    if (!existing) return null;
    return prisma.review.delete({ where: { id: existing.id } });
  }

  // ── Review-specific ────────────────────────────────────────────────────────

  async findUserReview(productId, userId) {
    const row = await prisma.review.findFirst({ where: { productId, userId } });
    return toMongo(row);
  }

  async findByProduct(productId, skip = 0, limit = 20) {
    const rows = await prisma.review.findMany({
      where: { productId, isApproved: true, isHidden: false },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
    return rows.map(toMongo);
  }

  async voteHelpful(reviewId, userId) {
    const review = await prisma.review.findUnique({ where: { id: reviewId }, select: { votedBy: true, helpfulVotes: true } });
    if (!review) return null;
    const alreadyVoted = review.votedBy.includes(userId);
    const row = await prisma.review.update({
      where: { id: reviewId },
      data: {
        helpfulVotes: { increment: alreadyVoted ? -1 : 1 },
        votedBy: { set: alreadyVoted
          ? review.votedBy.filter((id) => id !== userId)
          : [...review.votedBy, userId] },
      },
    });
    return { ...toMongo(row), action: alreadyVoted ? 'removed' : 'added' };
  }
}

module.exports = new ReviewRepository();
