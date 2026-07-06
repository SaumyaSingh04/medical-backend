'use strict';

const userRepo = require('../repositories/userRepo');
const productRepo = require('../repositories/productRepo');
const orderRepo = require('../repositories/orderRepo');
const { categoryRepo } = require('../repositories');
const { parsePagination, buildPaginationMeta } = require('../helpers/paginate');
const ApiError = require('../helpers/ApiError');
const { ROLES } = require('../constants');
const prisma = require('../repositories/prismaClient');
const { resolveDateRange } = require('../utils/dateRange');

class AdminService {
  async getDashboardStats() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [userCount, productCount, orderStats, newUsersToday, newUsersThisMonth, lowStockCount] = await Promise.all([
      userRepo.count({ role: ROLES.USER, isActive: true }),
      productRepo.count({ isActive: true }),
      orderRepo.getDashboardStats(),
      prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.product.count({ where: { isActive: true, stock: { lte: 5 } } }),
    ]);

    const revenue = orderStats.reduce((sum, s) => {
      if (!['cancelled', 'failed', 'pending'].includes(s._id)) return sum + s.revenue;
      return sum;
    }, 0);

    const orderCount = orderStats.reduce((sum, s) => sum + s.count, 0);
    const pendingOrders = orderStats.find((s) => s._id === 'pending')?.count || 0;
    const deliveredOrders = orderStats.find((s) => s._id === 'delivered')?.count || 0;

    const recentOrders = await prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });

    const recentUsers = await prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, firstName: true, lastName: true, email: true, createdAt: true, role: true },
    });

    return {
      userCount, productCount, orderCount, revenue,
      pendingOrders, deliveredOrders, orderStats,
      newUsersToday, newUsersThisMonth, lowStockCount,
      recentOrders, recentUsers,
    };
  }

  async getRevenueAnalytics(range = 'thisMonth', from, to) {
    const { start, end, label } = resolveDateRange(range, from, to);
    const dateFilter = start ? { gte: start, lte: end } : undefined;
    const baseWhere  = { status: { notIn: ['cancelled', 'failed', 'pending'] }, ...(dateFilter && { createdAt: dateFilter }) };

    const rows = start
      ? await prisma.$queryRawUnsafe(`
          SELECT DATE_TRUNC('day', "createdAt") AS day,
                 SUM("totalAmount") AS revenue,
                 COUNT(*) AS orders
          FROM "Order"
          WHERE "createdAt" >= $1 AND "createdAt" <= $2
            AND status NOT IN ('cancelled','failed','pending')
          GROUP BY 1 ORDER BY 1`, start, end)
      : await prisma.$queryRawUnsafe(`
          SELECT DATE_TRUNC('day', "createdAt") AS day,
                 SUM("totalAmount") AS revenue,
                 COUNT(*) AS orders
          FROM "Order"
          WHERE status NOT IN ('cancelled','failed','pending')
          GROUP BY 1 ORDER BY 1`);

    const [totalRevenue, avgOrderValue, revenueByPaymentMethod] = await Promise.all([
      prisma.order.aggregate({ _sum: { totalAmount: true }, where: baseWhere }),
      prisma.order.aggregate({ _avg: { totalAmount: true }, where: baseWhere }),
      prisma.order.groupBy({
        by: ['paymentMethod'],
        _sum: { totalAmount: true },
        _count: { id: true },
        where: baseWhere,
      }),
    ]);

    return {
      range: label,
      totalRevenue: Number(totalRevenue._sum.totalAmount || 0),
      avgOrderValue: Number(avgOrderValue._avg.totalAmount || 0),
      revenueByPaymentMethod: revenueByPaymentMethod.map((r) => ({
        method: r.paymentMethod,
        revenue: Number(r._sum.totalAmount || 0),
        orders: r._count.id,
      })),
      dailyRevenue: rows.map((r) => ({
        day: r.day,
        revenue: Number(r.revenue),
        orders: Number(r.orders),
      })),
    };
  }

  async getSalesAnalytics(range = 'thisMonth', from, to) {
    const { start, end, label } = resolveDateRange(range, from, to);
    const dateFilter = start ? { createdAt: { gte: start, lte: end } } : {};

    const [ordersByStatus, salesTrend, couponUsage] = await Promise.all([
      prisma.order.groupBy({
        by: ['status'],
        _count: { id: true },
        _sum: { totalAmount: true },
        where: { ...dateFilter },
      }),
      start
        ? prisma.$queryRawUnsafe(`
            SELECT DATE_TRUNC('day', "createdAt") AS day,
                   COUNT(*) AS orders,
                   SUM("totalAmount") AS revenue,
                   AVG("totalAmount") AS avg_order_value
            FROM "Order"
            WHERE "createdAt" >= $1 AND "createdAt" <= $2
            GROUP BY 1 ORDER BY 1`, start, end)
        : prisma.$queryRawUnsafe(`
            SELECT DATE_TRUNC('day', "createdAt") AS day,
                   COUNT(*) AS orders,
                   SUM("totalAmount") AS revenue,
                   AVG("totalAmount") AS avg_order_value
            FROM "Order"
            GROUP BY 1 ORDER BY 1`),
      prisma.order.aggregate({
        _count: { couponCode: true },
        _sum: { couponDiscount: true },
        where: { couponCode: { not: null }, ...dateFilter },
      }),
    ]);

    const totalOrders    = ordersByStatus.reduce((s, r) => s + r._count.id, 0);
    const cancelledOrders = ordersByStatus.find((r) => r.status === 'cancelled')?._count.id || 0;

    return {
      range: label,
      totalOrders,
      cancelledOrders,
      cancellationRate: totalOrders ? Math.round((cancelledOrders / totalOrders) * 100) : 0,
      ordersByStatus: ordersByStatus.map((r) => ({
        status: r.status,
        count: r._count.id,
        revenue: Number(r._sum.totalAmount || 0),
      })),
      salesTrend: salesTrend.map((r) => ({
        day: r.day,
        orders: Number(r.orders),
        revenue: Number(r.revenue),
        avgOrderValue: Number(r.avg_order_value),
      })),
      couponUsage: {
        ordersWithCoupon: couponUsage._count.couponCode || 0,
        totalDiscount: Number(couponUsage._sum.couponDiscount || 0),
      },
    };
  }

  async getCustomerAnalytics(range = 'thisMonth', from, to) {
    const { start, end, label } = resolveDateRange(range, from, to);
    const newCustomerWhere = start
      ? { role: 'user', createdAt: { gte: start, lte: end } }
      : { role: 'user' };

    const [totalCustomers, activeCustomers, newCustomers, registrationTrend, topCustomers, customersByRole] = await Promise.all([
      prisma.user.count({ where: { role: 'user' } }),
      prisma.user.count({ where: { role: 'user', isActive: true } }),
      prisma.user.count({ where: newCustomerWhere }),
      start
        ? prisma.$queryRawUnsafe(`
            SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*) AS count
            FROM "User"
            WHERE "createdAt" >= $1 AND "createdAt" <= $2 AND role = 'user'
            GROUP BY 1 ORDER BY 1`, start, end)
        : prisma.$queryRawUnsafe(`
            SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*) AS count
            FROM "User"
            WHERE role = 'user'
            GROUP BY 1 ORDER BY 1`),
      prisma.$queryRawUnsafe(`
        SELECT u.id, u."firstName", u."lastName", u.email,
               COUNT(o.id) AS order_count,
               SUM(o."totalAmount") AS total_spent
        FROM "User" u
        JOIN "Order" o ON o."userId" = u.id
        WHERE o.status NOT IN ('cancelled','failed','pending')
        GROUP BY u.id, u."firstName", u."lastName", u.email
        ORDER BY total_spent DESC
        LIMIT 10`),
      prisma.user.groupBy({ by: ['role'], _count: { id: true } }),
    ]);

    return {
      range: label,
      totalCustomers,
      activeCustomers,
      newCustomers,
      registrationTrend: registrationTrend.map((r) => ({ day: r.day, count: Number(r.count) })),
      topCustomers: topCustomers.map((r) => ({
        id: r.id,
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        orderCount: Number(r.order_count),
        totalSpent: Number(r.total_spent),
      })),
      customersByRole: customersByRole.map((r) => ({ role: r.role, count: r._count.id })),
    };
  }

  async getOrderAnalytics(range = 'thisMonth', from, to) {
    const { start, end, label } = resolveDateRange(range, from, to);
    const dateFilter = start ? { createdAt: { gte: start, lte: end } } : {};

    const [orderStats, paymentMethodBreakdown, avgFulfillmentRows, returnStats] = await Promise.all([
      prisma.order.groupBy({
        by: ['status'],
        _count: { id: true },
        _sum: { totalAmount: true },
        where: { ...dateFilter },
      }),
      prisma.order.groupBy({
        by: ['paymentMethod'],
        _count: { id: true },
        _sum: { totalAmount: true },
        where: { ...dateFilter },
      }),
      start
        ? prisma.$queryRawUnsafe(`
            SELECT AVG(EXTRACT(EPOCH FROM ("deliveredAt" - "createdAt")) / 86400) AS avg_days
            FROM "Order"
            WHERE status = 'delivered' AND "deliveredAt" IS NOT NULL
              AND "createdAt" >= $1 AND "createdAt" <= $2`, start, end)
        : prisma.$queryRawUnsafe(`
            SELECT AVG(EXTRACT(EPOCH FROM ("deliveredAt" - "createdAt")) / 86400) AS avg_days
            FROM "Order"
            WHERE status = 'delivered' AND "deliveredAt" IS NOT NULL`),
      prisma.order.count({
        where: { status: { in: ['return_requested', 'returned', 'refunded'] }, ...dateFilter },
      }),
    ]);

    const totalOrders    = orderStats.reduce((s, r) => s + r._count.id, 0);
    const deliveredOrders = orderStats.find((r) => r.status === 'delivered')?._count.id || 0;

    return {
      range: label,
      totalOrders,
      deliveredOrders,
      deliveryRate: totalOrders ? Math.round((deliveredOrders / totalOrders) * 100) : 0,
      returnCount: returnStats,
      returnRate: totalOrders ? Math.round((returnStats / totalOrders) * 100) : 0,
      avgFulfillmentDays: Number(avgFulfillmentRows[0]?.avg_days || 0).toFixed(1),
      ordersByStatus: orderStats.map((r) => ({
        status: r.status,
        count: r._count.id,
        revenue: Number(r._sum.totalAmount || 0),
      })),
      paymentMethodBreakdown: paymentMethodBreakdown.map((r) => ({
        method: r.paymentMethod,
        count: r._count.id,
        revenue: Number(r._sum.totalAmount || 0),
      })),
    };
  }

  async getTopProducts(limit = 10) {
    // Use parameterised query — limit is already clamped to 1-50 in the controller
    const safeLimit = Math.max(1, Math.min(50, parseInt(limit, 10) || 10));
    const rows = await prisma.$queryRaw`
      SELECT p.id, p.name, p.slug, p."thumbnailUrl", p.price, p."totalSold",
             p."averageRating", p."ratingCount", p.stock,
             SUM(oi."totalPrice") AS revenue,
             SUM(oi.quantity) AS units_sold
      FROM "Product" p
      JOIN "OrderItem" oi ON oi."productId" = p.id
      JOIN "Order" o ON o.id = oi."orderId"
      WHERE o.status NOT IN ('cancelled','failed','pending')
      GROUP BY p.id, p.name, p.slug, p."thumbnailUrl", p.price, p."totalSold",
               p."averageRating", p."ratingCount", p.stock
      ORDER BY units_sold DESC
      LIMIT ${safeLimit}`;

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      thumbnail: r.thumbnailUrl ? { url: r.thumbnailUrl } : null,
      price: Number(r.price),
      totalSold: r.totalSold,
      averageRating: Number(r.averageRating),
      ratingCount: r.ratingCount,
      stock: r.stock,
      revenue: Number(r.revenue),
      unitsSold: Number(r.units_sold),
    }));
  }

  async getLowStockAlerts(threshold = 10) {
    const products = await prisma.product.findMany({
      where: { isActive: true, stock: { lte: threshold } },
      orderBy: { stock: 'asc' },
      select: {
        id: true, name: true, slug: true, sku: true,
        stock: true, lowStockThreshold: true,
        thumbnailUrl: true, price: true,
        category: { select: { id: true, name: true } },
      },
    });

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      stock: p.stock,
      lowStockThreshold: p.lowStockThreshold,
      thumbnail: p.thumbnailUrl ? { url: p.thumbnailUrl } : null,
      price: Number(p.price),
      category: p.category,
      status: p.stock === 0 ? 'out_of_stock' : 'low_stock',
    }));
  }

  async getRecentActivities(limit = 20) {
    const [recentOrders, recentUsers, recentReviews] = await Promise.all([
      prisma.order.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, orderNumber: true, status: true, totalAmount: true, createdAt: true,
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      prisma.user.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: { id: true, firstName: true, lastName: true, email: true, role: true, createdAt: true },
      }),
      prisma.review.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, rating: true, comment: true, createdAt: true,
          user: { select: { id: true, firstName: true, lastName: true } },
          product: { select: { id: true, name: true, slug: true } },
        },
      }),
    ]);

    const activities = [
      ...recentOrders.map((o) => ({
        type: 'order',
        id: o.id,
        message: `Order ${o.orderNumber} placed — ₹${Number(o.totalAmount).toFixed(2)}`,
        status: o.status,
        user: o.user,
        createdAt: o.createdAt,
      })),
      ...recentUsers.map((u) => ({
        type: 'registration',
        id: u.id,
        message: `New user registered — ${u.firstName} ${u.lastName}`,
        user: { id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email },
        createdAt: u.createdAt,
      })),
      ...recentReviews.map((r) => ({
        type: 'review',
        id: r.id,
        message: `Review (${r.rating}★) on ${r.product?.name}`,
        user: r.user,
        product: r.product,
        createdAt: r.createdAt,
      })),
    ];

    return activities
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  async getSalesReport(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start) || isNaN(end)) throw ApiError.badRequest('Invalid date range.');
    return orderRepo.getSalesReport(start, end);
  }

  async listUsers(queryParams) {
    const { page, limit, skip } = parsePagination(queryParams);
    const filter = {};
    if (queryParams.role) filter.role = queryParams.role;
    if (queryParams.isActive !== undefined) filter.isActive = queryParams.isActive !== 'false';

    if (queryParams.search) {
      const [users, total] = await Promise.all([
        userRepo.searchUsers(queryParams.search, filter, skip, limit),
        userRepo.countSearch(queryParams.search, filter),
      ]);
      return { users, meta: buildPaginationMeta(total, page, limit) };
    }

    const [users, total] = await Promise.all([
      userRepo.findAll(filter, { sort: { createdAt: -1 }, skip, limit }),
      userRepo.count(filter),
    ]);
    return { users, meta: buildPaginationMeta(total, page, limit) };
  }

  async toggleUserStatus(userId) {
    const user = await userRepo.findById(userId);
    if (!user) throw ApiError.notFound('User not found.');
    return userRepo.updateById(userId, { isActive: !user.isActive }, { new: true });
  }

  async updateUserRole(userId, role) {
    if (![ROLES.USER, ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(role)) {
      throw ApiError.badRequest('Invalid role.');
    }
    const user = await userRepo.findById(userId);
    if (!user) throw ApiError.notFound('User not found.');
    return userRepo.updateById(userId, { role }, { new: true });
  }

  async listProducts(queryParams) {
    const { page, limit, skip } = parsePagination(queryParams);
    const filter = await productRepo.buildFilter({
      ...queryParams,
      q: queryParams.search,
      // If isActive not explicitly passed, skip the filter so all products are shown
      isActive: queryParams.isActive !== undefined ? queryParams.isActive : 'all',
    });

    const [products, total] = await Promise.all([
      productRepo.findAll(filter, { sort: { createdAt: -1 }, skip, limit }),
      productRepo.count(filter),
    ]);
    return { products, meta: buildPaginationMeta(total, page, limit) };
  }

  async listOrders(queryParams) {
    const { page, limit, skip } = parsePagination(queryParams);
    const filter = {};
    if (queryParams.status) filter.status = queryParams.status;
    if (queryParams.search) filter.orderNumber = queryParams.search;
    const [orders, total] = await Promise.all([
      orderRepo.findAll(filter, { sort: { createdAt: -1 }, skip, limit, populate: [{ path: 'user', select: 'firstName lastName email phone' }] }),
      orderRepo.count(filter),
    ]);
    return { orders, meta: buildPaginationMeta(total, page, limit) };
  }
}

module.exports = new AdminService();
