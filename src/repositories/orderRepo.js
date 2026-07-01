'use strict';

const prisma = require('./prismaClient');

function toMongo(row) {
  if (!row) return null;
  const { id, userId, paymentId, items = [], ...rest } = row;
  return {
    ...rest,
    _id: id,
    id,
    user: userId,
    payment: paymentId ?? null,
    items: items.map(itemToMongo),
    // shippingAddress: reassemble nested shape services expect
    shippingAddress: rest.shippingFullName ? {
      fullName: rest.shippingFullName,
      phone: rest.shippingPhone,
      addressLine1: rest.shippingAddressLine1,
      addressLine2: rest.shippingAddressLine2,
      city: rest.shippingCity,
      state: rest.shippingState,
      pincode: rest.shippingPincode,
      country: rest.shippingCountry,
    } : null,
  };
}

function itemToMongo(item) {
  if (!item) return null;
  const { id, orderId, productId, variantId, variantName, variantColor, variantSize, price, compareAtPrice, totalPrice, product, ...rest } = item;
  let productOut = productId ?? null;
  if (product) {
    const { thumbnailUrl, thumbnailPublicId, ...pRest } = product;
    productOut = {
      ...pRest,
      _id: product.id,
      thumbnail: thumbnailUrl ? { url: thumbnailUrl, publicId: thumbnailPublicId ?? null } : null,
    };
  }
  return {
    ...rest,
    _id: id,
    id,
    product: productOut,
    variant: variantId ?? null,
    variantDetails: (variantName || variantColor || variantSize)
      ? { name: variantName, color: variantColor, size: variantSize }
      : null,
    price: Number(price),
    compareAtPrice: compareAtPrice != null ? Number(compareAtPrice) : null,
    totalPrice: Number(totalPrice),
  };
}

function toPrismaData(data) {
  const { _id, __v, user, payment, items, shippingAddress, statusHistory, ...rest } = data;
  const out = { ...rest };
  if (user !== undefined) out.userId = user;
  if (payment !== undefined) out.paymentId = payment;
  if (shippingAddress) {
    out.shippingFullName     = shippingAddress.fullName ?? null;
    out.shippingPhone        = shippingAddress.phone ?? null;
    out.shippingAddressLine1 = shippingAddress.addressLine1 ?? null;
    out.shippingAddressLine2 = shippingAddress.addressLine2 ?? null;
    out.shippingCity         = shippingAddress.city ?? null;
    out.shippingState        = shippingAddress.state ?? null;
    out.shippingPincode      = shippingAddress.pincode ?? null;
    out.shippingCountry      = shippingAddress.country ?? 'India';
  }
  return out;
}

function toWhere(filter = {}) {
  const where = {};
  for (const [k, v] of Object.entries(filter)) {
    if (k === '_id' || k === 'id') { where.id = v; continue; }
    if (k === 'user')              { where.userId = v; continue; }
    if (k === 'payment')           { where.paymentId = v; continue; }
    if (v instanceof RegExp)       { where[k] = { contains: v.source, mode: 'insensitive' }; continue; }
    if (k === 'orderNumber' && typeof v === 'string') { where.orderNumber = { contains: v, mode: 'insensitive' }; continue; }
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
  return Object.entries(sort).map(([k, v]) => ({ [k]: v === -1 || v === 'desc' ? 'desc' : 'asc' }));
}

const ORDER_INCLUDE = {
  items: true,
};

const ORDER_WITH_PAYMENT = {
  items: true,
  payment: true,
  user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
};

function generateOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
  return `TRV-${date}-${rand}`;
}

class OrderRepository {
  async findById(id) {
    const row = await prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    return toMongo(row);
  }

  async findOne(filter) {
    const row = await prisma.order.findFirst({ where: toWhere(filter), include: ORDER_INCLUDE });
    return toMongo(row);
  }

  async count(filter = {}) {
    return prisma.order.count({ where: toWhere(filter) });
  }

  async create(data) {
    const { items = [], ...orderData } = data;
    const prismaData = toPrismaData(orderData);

    // Auto-generate order number
    if (!prismaData.orderNumber) {
      prismaData.orderNumber = generateOrderNumber();
    }

    const row = await prisma.order.create({
      data: {
        ...prismaData,
        items: {
          create: items.map((item) => ({
            productId:     item.product ?? null,
            variantId:     item.variant ?? null,
            name:          item.name,
            slug:          item.slug ?? null,
            thumbnail:     item.thumbnail ?? null,
            sku:           item.sku ?? null,
            variantName:   item.variantDetails?.name ?? null,
            variantColor:  item.variantDetails?.color ?? null,
            variantSize:   item.variantDetails?.size ?? null,
            quantity:      item.quantity,
            price:         item.price,
            compareAtPrice: item.compareAtPrice ?? null,
            totalPrice:    item.totalPrice,
          })),
        },
      },
      include: ORDER_INCLUDE,
    });
    return toMongo(row);
  }

  async updateById(id, data) {
    const row = await prisma.order.update({
      where: { id },
      data: toPrismaData(data),
      include: ORDER_INCLUDE,
    });
    return toMongo(row);
  }

  async findAll(filter = {}, options = {}) {
    const { sort = { createdAt: -1 }, skip = 0, limit = 20, populate = [] } = options;
    const include = { ...ORDER_INCLUDE };
    if (populate.some((p) => (typeof p === 'string' ? p : p.path) === 'user')) {
      include.user = { select: { id: true, firstName: true, lastName: true, email: true, phone: true } };
    }
    const rows = await prisma.order.findMany({
      where: toWhere(filter),
      orderBy: toOrderBy(sort),
      skip,
      take: limit,
      include,
    });
    return rows.map(toMongo);
  }

  // ── Order-specific ──────────────────────────────────────────────────────────

  async findUserOrders(userId, skip, limit) {
    const rows = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, slug: true, thumbnailUrl: true } },
          },
        },
      },
    });
    return rows.map(toMongo);
  }

  async findWithPayment(orderId) {
    const row = await prisma.order.findUnique({
      where: { id: orderId },
      include: ORDER_WITH_PAYMENT,
    });
    return toMongo(row);
  }

  async addStatusHistory(orderId, status, note, updatedBy) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { statusHistory: true } });
    if (!order) return null;
    const entry = { status, note, updatedBy, timestamp: new Date().toISOString() };
    const row = await prisma.order.update({
      where: { id: orderId },
      data: { status, statusHistory: [...order.statusHistory, entry] },
      include: ORDER_INCLUDE,
    });
    return toMongo(row);
  }

  async getSalesReport(startDate, endDate) {
    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        status: { notIn: ['cancelled', 'failed'] },
      },
      select: { createdAt: true, totalAmount: true },
    });

    const grouped = {};
    for (const o of orders) {
      const day = o.createdAt.toISOString().slice(0, 10);
      if (!grouped[day]) grouped[day] = { _id: day, orders: 0, revenue: 0 };
      grouped[day].orders += 1;
      grouped[day].revenue += Number(o.totalAmount);
    }
    return Object.values(grouped).sort((a, b) => a._id.localeCompare(b._id));
  }

  async getDashboardStats() {
    const orders = await prisma.order.findMany({
      select: { status: true, totalAmount: true },
    });
    const grouped = {};
    for (const o of orders) {
      if (!grouped[o.status]) grouped[o.status] = { _id: o.status, count: 0, revenue: 0 };
      grouped[o.status].count += 1;
      grouped[o.status].revenue += Number(o.totalAmount);
    }
    return Object.values(grouped);
  }
}

module.exports = new OrderRepository();
