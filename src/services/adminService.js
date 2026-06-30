'use strict';

const userRepo = require('../repositories/userRepo');
const productRepo = require('../repositories/productRepo');
const orderRepo = require('../repositories/orderRepo');
const { categoryRepo } = require('../repositories');
const { parsePagination, buildPaginationMeta } = require('../helpers/paginate');
const ApiError = require('../helpers/ApiError');
const { ROLES } = require('../constants');

class AdminService {
  async getDashboardStats() {
    const [userCount, productCount, orderStats] = await Promise.all([
      userRepo.count({ role: ROLES.USER, isActive: true }),
      productRepo.count({ isActive: true }),
      orderRepo.getDashboardStats(),
    ]);

    const revenue = orderStats.reduce((sum, s) => {
      if (!['cancelled', 'failed', 'pending'].includes(s._id)) return sum + s.revenue;
      return sum;
    }, 0);

    const orderCount = orderStats.reduce((sum, s) => sum + s.count, 0);
    const pendingOrders = orderStats.find((s) => s._id === 'pending')?.count || 0;
    const deliveredOrders = orderStats.find((s) => s._id === 'delivered')?.count || 0;

    return { userCount, productCount, orderCount, revenue, pendingOrders, deliveredOrders, orderStats };
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

    if (queryParams.search) {
      const searchFilter = { ...filter };
      const [users, total] = await Promise.all([
        userRepo.searchUsers(queryParams.search, searchFilter, skip, limit),
        userRepo.count(searchFilter),
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
    if (![ROLES.USER, ROLES.ADMIN].includes(role)) {
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
