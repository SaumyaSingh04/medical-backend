'use strict';

const { randomInt } = require('crypto');
const prisma = require('./prismaClient');
const { toOrderBy } = require('./repoUtils');

function toMongo(row) {
  if (!row) return null;
  const { id, userId, paymentId, items = [], ...rest } = row;
  return {
    ...rest,
    _id: id,
    id,
    user:    userId,
    payment: paymentId ?? null,
    items:   items.map(itemToMongo),
    shippingAddress: rest.shippingFullName ? {
      fullName:     rest.shippingFullName,
      phone:        rest.shippingPhone,
      addressLine1: rest.shippingAddressLine1,
      addressLine2: rest.shippingAddressLine2,
      city:         rest.shippingCity,
      state:        rest.shippingState,
      pincode:      rest.shippingPincode,
      country:      rest.shippingCountry,
    } : null,
  };
}

function itemToMongo(item) {
  if (!item) return null;
  const { id, orderId, productId, variantId, variantName, variantColor, variantSize,
          price, compareAtPrice, totalPrice, product, ...rest } = item;
  let productOut = productId ?? null;
  if (product) {
    const { thumbnailUrl, thumbnailPublicId, ...pRest } = product;
    productOut = { ...pRest, _id: product.id, thumbnail: thumbnailUrl ? { url: thumbnailUrl, publicId: thumbnailPublicId ?? null } : null };
  }
  return {
    ...rest,
    _id: id, id,
    product: productOut,
    variant: variantId ?? null,
    variantDetails: (variantName || variantColor || variantSize)
      ? { name: variantName, color: variantColor, size: variantSize } : null,
    price:          Number(price),
    compareAtPrice: compareAtPrice != null ? Number(compareAtPrice) : null,
    totalPrice:     Number(totalPrice),
  };
}

function toPrismaData(data) {
  const { _id, __v, user, payment, items, shippingAddress, statusHistory, ...rest } = data;
  const out = { ...rest };
  if (user    !== undefined) out.userId    = user;
  if (payment !== undefined) out.paymentId = payment;
  if (shippingAddress) {
    out.shippingFullName     = shippingAddress.fullName     ?? null;
    out.shippingPhone        = shippingAddress.phone        ?? null;
    out.shippingAddressLine1 = shippingAddress.addressLine1 ?? null;
    out.shippingAddressLine2 = shippingAddress.addressLine2 ?? null;
    out.shippingCity         = shippingAddress.city         ?? null;
    out.shippingState        = shippingAddress.state        ?? null;
    out.shippingPincode      = shippingAddress.pincode      ?? null;
    out.shippingCountry      = shippingAddress.country      ?? 'India';
  }
  return out;
}

function toWhere(filter = {}) {
  const where = {};
  for (const [k, v] of Object.entries(filter)) {
    if (k === '_id' || k === 'id')  { where.id        = v; continue; }
    if (k === 'user')               { where.userId    = v; continue; }
    if (k === 'payment')            { where.paymentId = v; continue; }
    if (v instanceof RegExp)        { where[k] = { contains: v.source, mode: 'insensitive' }; continue; }
    if (k === 'orderNumber' && typeof v === 'string') { where.orderNumber = { contains: v, mode: 'insensitive' }; continue; }
    where[k] = v;
  }
  return where;
}

const ORDER_INCLUDE = { items: true };

const ORDER_WITH_PAYMENT = {
  items: true,
  payment: true,
  user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
};

const USER_SELECT = { select: { id: true, firstName: true, lastName: true, email: true, phone: true } };

// Lookup replaces if-chain in addStatusHistory
const STATUS_TIMESTAMP = {
  delivered:        'deliveredAt',
  cancelled:        'cancelledAt',
  return_requested: 'returnRequestedAt',
};

function generateOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `TRV-${date}-${randomInt(0, 99999).toString().padStart(5, '0')}`;
}

class OrderRepository {
  async findById(id) {
    return toMongo(await prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE }));
  }

  async findOne(filter) {
    return toMongo(await prisma.order.findFirst({ where: toWhere(filter), include: ORDER_INCLUDE }));
  }

  async count(filter = {}) {
    return prisma.order.count({ where: toWhere(filter) });
  }

  async create(data) {
    const { items = [], ...orderData } = data;
    const prismaData = toPrismaData(orderData);
    if (!prismaData.orderNumber) prismaData.orderNumber = generateOrderNumber();

    return toMongo(await prisma.order.create({
      data: {
        ...prismaData,
        items: {
          create: items.map((item) => ({
            productId:      item.product       ?? null,
            variantId:      item.variant       ?? null,
            name:           item.name,
            slug:           item.slug          ?? null,
            thumbnail:      item.thumbnail     ?? null,
            sku:            item.sku           ?? null,
            variantName:    item.variantDetails?.name  ?? null,
            variantColor:   item.variantDetails?.color ?? null,
            variantSize:    item.variantDetails?.size  ?? null,
            quantity:       item.quantity,
            price:          item.price,
            compareAtPrice: item.compareAtPrice ?? null,
            totalPrice:     item.totalPrice,
          })),
        },
      },
      include: ORDER_INCLUDE,
    }));
  }

  async updateById(id, data) {
    return toMongo(await prisma.order.update({ where: { id }, data: toPrismaData(data), include: ORDER_INCLUDE }));
  }

  async findAll(filter = {}, options = {}) {
    const { sort = { createdAt: -1 }, skip = 0, limit = 20, populate = [] } = options;
    const include = { ...ORDER_INCLUDE };
    if (populate.some((p) => (typeof p === 'string' ? p : p.path) === 'user')) {
      include.user = USER_SELECT;
    }
    const rows = await prisma.order.findMany({ where: toWhere(filter), orderBy: toOrderBy(sort), skip, take: limit, include });
    return rows.map(toMongo);
  }

  async findUserOrders(userId, skip, limit) {
    const rows = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip, take: limit,
      include: { items: { include: { product: { select: { id: true, name: true, slug: true, thumbnailUrl: true } } } } },
    });
    return rows.map(toMongo);
  }

  async findWithPayment(orderId) {
    return toMongo(await prisma.order.findUnique({ where: { id: orderId }, include: ORDER_WITH_PAYMENT }));
  }

  async addStatusHistory(orderId, status, note, updatedBy) {
    const entry = { status, note, updatedBy, timestamp: new Date().toISOString() };
    const tsField = STATUS_TIMESTAMP[status];

    return toMongo(await prisma.order.update({
      where: { id: orderId },
      data: {
        status,
        ...(note && status === 'return_requested' ? { returnReason: note } : {}),
        statusHistory: { push: entry },
        ...(tsField ? { [tsField]: new Date() } : {}),
      },
      include: ORDER_INCLUDE,
    }));
  }

  async getSalesReport(startDate, endDate) {
    const rows = await prisma.$queryRaw`
      SELECT DATE_TRUNC('day', "createdAt")::date AS "_id",
             COUNT(*)::int                         AS "orders",
             SUM("totalAmount")::float             AS "revenue"
      FROM "Order"
      WHERE "createdAt" >= ${startDate}
        AND "createdAt" <= ${endDate}
        AND status NOT IN ('cancelled', 'failed')
      GROUP BY 1
      ORDER BY 1
    `;
    return rows.map((r) => ({ _id: r._id, orders: r.orders, revenue: Number(r.revenue) }));
  }

  async getDashboardStats() {
    const rows = await prisma.order.groupBy({
      by: ['status'],
      _count: { id: true },
      _sum:   { totalAmount: true },
    });
    return rows.map((r) => ({ _id: r.status, count: r._count.id, revenue: Number(r._sum.totalAmount || 0) }));
  }

  async getStatusGroupByUser(userId) {
    const rows = await prisma.order.groupBy({ by: ['status'], _count: { id: true }, where: { userId } });
    return rows.map((r) => ({ status: r.status, count: r._count.id }));
  }

  async getRecentByUser(userId, take = 5) {
    return prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true, orderNumber: true, status: true, totalAmount: true, createdAt: true,
        items: { select: { name: true, quantity: true, thumbnail: true }, take: 1 },
      },
    });
  }

  async getMonthlySpend(userId, monthStart) {
    const result = await prisma.order.aggregate({
      _sum:  { totalAmount: true },
      where: { userId, createdAt: { gte: monthStart }, status: { notIn: ['cancelled', 'failed'] } },
    });
    return Number(result._sum.totalAmount || 0);
  }
}

module.exports = new OrderRepository();
