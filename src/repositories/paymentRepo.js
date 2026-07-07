'use strict';

const prisma = require('./prismaClient');

function toMongo(row) {
  if (!row) return null;
  const { id, userId, amount, totalRefunded, ...rest } = row;
  return { ...rest, _id: id, id, user: userId, amount: Number(amount), totalRefunded: Number(totalRefunded) };
}

function toPrismaData(data) {
  const { _id, __v, user, order, ...rest } = data;
  const out = { ...rest };
  if (user !== undefined) out.userId = user;
  return out;
}

function toWhere(filter = {}) {
  const where = {};
  for (const [k, v] of Object.entries(filter)) {
    where[k === '_id' || k === 'id' ? 'id' : k] = v;
  }
  return where;
}

class PaymentRepository {
  async findById(id) {
    return toMongo(await prisma.payment.findUnique({ where: { id } }));
  }

  async findOne(filter) {
    return toMongo(await prisma.payment.findFirst({ where: toWhere(filter) }));
  }

  async create(data) {
    return toMongo(await prisma.payment.create({ data: toPrismaData(data) }));
  }

  async updateById(id, data) {
    return toMongo(await prisma.payment.update({ where: { id }, data: toPrismaData(data) }));
  }

  async findByRazorpayOrderId(id) {
    return toMongo(await prisma.payment.findFirst({ where: { razorpayOrderId: id } }));
  }

  async findByStripeIntentId(id) {
    return toMongo(await prisma.payment.findFirst({ where: { stripePaymentIntentId: id } }));
  }

  // Single atomic push — no prior read needed
  async pushWebhookEvent(paymentId, event) {
    try {
      return prisma.payment.update({ where: { id: paymentId }, data: { webhookEvents: { push: event } } });
    } catch {
      return null;
    }
  }

  // Single atomic push + increment — no prior read needed
  async pushRefund(paymentId, refundEntry) {
    try {
      return prisma.payment.update({
        where: { id: paymentId },
        data: { refunds: { push: refundEntry }, totalRefunded: { increment: refundEntry.amount } },
      });
    } catch {
      return null;
    }
  }
}

module.exports = new PaymentRepository();
