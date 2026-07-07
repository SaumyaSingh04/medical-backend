'use strict';

/**
 * ExportService — builds rows for CSV/Excel exports.
 * Reuses existing repos (orderRepo, userRepo, productRepo, leadRepo).
 * Actual file streaming is done by exportUtils.sendCSV / sendExcel.
 */

const prisma = require('../repositories/prismaClient');
const ApiError = require('../helpers/ApiError');

const MAX_EXPORT_ROWS = 5000;

function buildDateFilter(from, to, field = 'createdAt') {
  if (!from && !to) return {};
  return {
    [field]: {
      ...(from && { gte: new Date(from) }),
      ...(to   && { lte: new Date(to + 'T23:59:59.999Z') }),
    },
  };
}

class ExportService {
  async getOrderRows({ from, to, status } = {}) {
    const where = { ...buildDateFilter(from, to), ...(status && { status }) };

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT_ROWS,
      include: {
        user: { select: { firstName: true, lastName: true, email: true, phone: true } },
      },
    });

    const headers = [
      'Order Number', 'Status', 'Payment Method', 'Payment Status',
      'Subtotal', 'Shipping', 'Discount', 'Total',
      'Customer Name', 'Email', 'Phone',
      'City', 'State', 'Pincode', 'Created At',
    ];

    const rows = orders.map((o) => [
      o.orderNumber,
      o.status,
      o.paymentMethod,
      o.paymentStatus,
      Number(o.subtotal),
      Number(o.shippingCharge),
      Number(o.discount),
      Number(o.totalAmount),
      o.user ? `${o.user.firstName} ${o.user.lastName}` : o.shippingFullName ?? '',
      o.user?.email ?? '',
      o.user?.phone ?? '',
      o.shippingCity ?? '',
      o.shippingState ?? '',
      o.shippingPincode ?? '',
      o.createdAt.toISOString(),
    ]);

    return { headers, rows };
  }

  async getUserRows({ role, from, to } = {}) {
    const where = { ...buildDateFilter(from, to), ...(role && { role }) };

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT_ROWS,
      select: {
        id: true, firstName: true, lastName: true, email: true,
        phone: true, role: true, isActive: true,
        isEmailVerified: true, createdAt: true, lastLogin: true,
      },
    });

    const headers = [
      'ID', 'First Name', 'Last Name', 'Email', 'Phone',
      'Role', 'Active', 'Email Verified', 'Created At', 'Last Login',
    ];

    const rows = users.map((u) => [
      u.id, u.firstName, u.lastName, u.email, u.phone ?? '',
      u.role, u.isActive, u.isEmailVerified,
      u.createdAt.toISOString(), u.lastLogin?.toISOString() ?? '',
    ]);

    return { headers, rows };
  }

  async getProductRows({ categoryId, isActive } = {}) {
    const where = {};
    if (categoryId) where.categoryId = categoryId;
    if (isActive !== undefined) where.isActive = isActive !== 'false';

    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT_ROWS,
      include: { category: { select: { name: true } } },
    });

    const headers = [
      'ID', 'Name', 'SKU', 'Brand', 'Category',
      'Price', 'Compare At Price', 'Stock', 'Total Sold',
      'Average Rating', 'Active', 'Featured', 'Created At',
    ];

    const rows = products.map((p) => [
      p.id, p.name, p.sku ?? '', p.brand ?? '', p.category?.name ?? '',
      Number(p.price), p.compareAtPrice != null ? Number(p.compareAtPrice) : '',
      p.stock, p.totalSold, Number(p.averageRating),
      p.isActive, p.isFeatured, p.createdAt.toISOString(),
    ]);

    return { headers, rows };
  }

  async getLeadRows({ status, source, from, to } = {}) {
    const where = { isDeleted: false, ...buildDateFilter(from, to), ...(status && { status }), ...(source && { source }) };

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT_ROWS,
      include: { assignedTo: { select: { firstName: true, lastName: true } } },
    });

    const headers = [
      'ID', 'Name', 'Phone', 'Email', 'Status', 'Source',
      'City', 'State', 'Assigned To', 'Created At',
    ];

    const rows = leads.map((l) => [
      l.id, l.name, l.phone, l.email ?? '', l.status, l.source,
      l.city ?? '', l.state ?? '',
      l.assignedTo ? `${l.assignedTo.firstName} ${l.assignedTo.lastName}` : '',
      l.createdAt.toISOString(),
    ]);

    return { headers, rows };
  }
}

module.exports = new ExportService();
