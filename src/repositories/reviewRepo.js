'use strict';

const prisma = require('./prismaClient');

function toMongo(row) {
  if (!row) return null;
  const { id, productId, userId, orderId, replyMessage, replyRepliedAt, replyRepliedById, ...rest } = row;
  return {
    ...rest,
    _id: id, id,
    product: productId,
    user:    userId,
    order:   orderId ?? null,
    reply:   replyMessage ? { message: replyMessage, repliedAt: replyRepliedAt, repliedBy: replyRepliedById } : null,
  };
}

function toPrismaData(data) {
  const { _id, __v, product, user, order, reply, ...rest } = data;
  const out = { ...rest };
  if (product !== undefined) out.productId = product;
  if (user    !== undefined) out.userId    = user;
  if (order   !== undefined) out.orderId   = order ?? null;
  if (reply   !== undefined) {
    out.replyMessage     = reply?.message   ?? null;
    out.replyRepliedAt   = reply?.repliedAt ?? null;
    out.replyRepliedById = reply?.repliedBy ?? null;
  }
  return out;
}

function toWhere(filter = {}) {
  const where = {};
  for (const [k, v] of Object.entries(filter)) {
    const key = k === '_id' || k === 'id' ? 'id'
              : k === 'product' ? 'productId'
              : k === 'user'    ? 'userId'
              : k === 'order'   ? 'orderId'
              : k;
    where[key] = v;
  }
  return where;
}

class ReviewRepository {
  async findById(id) {
    return toMongo(await prisma.review.findUnique({ where: { id } }));
  }

  async findOne(filter) {
    return toMongo(await prisma.review.findFirst({ where: toWhere(filter) }));
  }

  async count(filter = {}) {
    return prisma.review.count({ where: toWhere(filter) });
  }

  async create(data) {
    return toMongo(await prisma.review.create({ data: toPrismaData(data) }));
  }

  async updateById(id, data) {
    return toMongo(await prisma.review.update({ where: { id }, data: toPrismaData(data) }));
  }

  async deleteById(id) {
    return toMongo(await prisma.review.delete({ where: { id } }));
  }

  async deleteOne(filter) {
    const existing = await prisma.review.findFirst({ where: toWhere(filter) });
    if (!existing) return null;
    return prisma.review.delete({ where: { id: existing.id } });
  }

  async findUserReview(productId, userId) {
    return toMongo(await prisma.review.findFirst({ where: { productId, userId } }));
  }

  async findByProduct(productId, skip = 0, limit = 20) {
    const rows = await prisma.review.findMany({
      where: { productId, isApproved: true, isHidden: false },
      orderBy: { createdAt: 'desc' },
      skip, take: limit,
      include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
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
        votedBy: { set: alreadyVoted ? review.votedBy.filter((id) => id !== userId) : [...review.votedBy, userId] },
      },
    });
    return { ...toMongo(row), action: alreadyVoted ? 'removed' : 'added' };
  }
}

module.exports = new ReviewRepository();
