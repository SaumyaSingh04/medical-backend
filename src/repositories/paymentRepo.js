'use strict';

const prisma = require('./prismaClient');

function toMongo(row) {
  if (!row) return null;
  const { id, userId, amount, totalRefunded, ...rest } = row;
  return {
    ...rest,
    _id: id,
    id,
    user: userId,
    amount: Number(amount),
    totalRefunded: Number(totalRefunded),
  };
}

function toPrismaData(data) {
  const { _id, __v, user, order, ...rest } = data;
  const out = { ...rest };
  if (user !== undefined) out.userId = user;
  // Payment has no orderId FK in Prisma — order is linked via Order.paymentId
  return out;
}

function toWhere(filter = {}) {
  const where = {};
  for (const [k, v] of Object.entries(filter)) {
    if (k === '_id' || k === 'id') { where.id = v; continue; }
    where[k] = v;
  }
  return where;
}

class PaymentRepository {
  async findById(id) {
    const row = await prisma.payment.findUnique({ where: { id } });
    return toMongo(row);
  }

  async findOne(filter) {
    const where = toWhere(filter);
    const row = await prisma.payment.findFirst({ where });
    return toMongo(row);
  }

  async create(data) {
    const row = await prisma.payment.create({ data: toPrismaData(data) });
    return toMongo(row);
  }

  async updateById(id, data) {
    const row = await prisma.payment.update({ where: { id }, data: toPrismaData(data) });
    return toMongo(row);
  }

  async findByRazorpayOrderId(id) {
    const row = await prisma.payment.findFirst({ where: { razorpayOrderId: id } });
    return toMongo(row);
  }

  async findByStripeIntentId(id) {
    const row = await prisma.payment.findFirst({ where: { stripePaymentIntentId: id } });
    return toMongo(row);
  }

  // Append a webhook event to the Json[] array
  async pushWebhookEvent(paymentId, event) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId }, select: { webhookEvents: true } });
    if (!payment) return null;
    return prisma.payment.update({
      where: { id: paymentId },
      data: { webhookEvents: [...payment.webhookEvents, event] },
    });
  }

  // Append a refund entry and increment totalRefunded
  async pushRefund(paymentId, refundEntry) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId }, select: { refunds: true, totalRefunded: true } });
    if (!payment) return null;
    return prisma.payment.update({
      where: { id: paymentId },
      data: {
        refunds: [...payment.refunds, refundEntry],
        totalRefunded: { increment: refundEntry.amount },
      },
    });
  }
}

module.exports = new PaymentRepository();
