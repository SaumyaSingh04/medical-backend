'use strict';

const userRepo = require('../repositories/userRepo');
const { deleteCloudinaryResource } = require('../config/cloudinary');
const ApiError = require('../helpers/ApiError');

class UserService {
  async getProfile(userId) {
    const user = await userRepo.findById(userId);
    if (!user) throw ApiError.notFound('User not found.');
    return user;
  }

  async updateProfile(userId, updateData) {
    const { firstName, lastName, phone, password } = updateData;
    // Email change is intentionally excluded — it requires a dedicated
    // verify-new-email flow to prevent account takeover.
    const updateObj = { firstName, lastName, phone };

    // Hash password if provided
    if (password) {
      const bcrypt = require('bcryptjs');
      const salt = await bcrypt.genSalt(12);
      updateObj.password = await bcrypt.hash(password, salt);
    }

    // Clean up undefined fields
    Object.keys(updateObj).forEach(key => {
      if (updateObj[key] === undefined) delete updateObj[key];
    });

    const user = await userRepo.updateById(userId, updateObj);
    if (!user) throw ApiError.notFound('User not found.');
    return user.toPublicJSON ? user.toPublicJSON() : user;
  }

  async uploadAvatar(userId, file) {
    const user = await userRepo.findById(userId);
    if (!user) throw ApiError.notFound('User not found.');

    // Delete old avatar
    if (user.avatar && user.avatar.publicId) {
      await deleteCloudinaryResource(user.avatar.publicId).catch(() => {});
    }

    const updated = await userRepo.updateById(userId, {
      avatar: { url: file.path, publicId: file.filename },
    }, { new: true });
    return updated;
  }

  async getAddresses(userId) {
    const user = await userRepo.findById(userId);
    if (!user) throw ApiError.notFound('User not found.');
    return user.addresses || [];
  }

  async addAddress(userId, addressData) {
    const updated = await userRepo.addAddress(userId, addressData);
    if (!updated) throw ApiError.notFound('User not found.');
    return updated.addresses;
  }

  async updateAddress(userId, addressId, addressData) {
    const updated = await userRepo.updateAddress(userId, addressId, addressData);
    if (!updated) throw ApiError.notFound('Address not found.');
    return updated.addresses;
  }

  async deleteAddress(userId, addressId) {
    const updated = await userRepo.deleteAddress(userId, addressId);
    if (!updated) throw ApiError.notFound('User not found.');
    return updated.addresses;
  }

  async setDefaultAddress(userId, addressId) {
    const updated = await userRepo.setDefaultAddress(userId, addressId);
    if (!updated) throw ApiError.notFound('User not found.');
    return updated.addresses;
  }

  async getWishlist(userId) {
    return userRepo.getWishlistWithProducts(userId);
  }

  async toggleWishlist(userId, productId) {
    const prisma = require('../repositories/prismaClient');
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) throw ApiError.notFound('Product not found.');

    const isWishlisted = await userRepo.isInWishlist(userId, productId);
    if (isWishlisted) {
      await userRepo.removeFromWishlist(userId, productId);
      return { wishlisted: false, productId };
    } else {
      await userRepo.addToWishlist(userId, productId);
      return { wishlisted: true, productId };
    }
  }

  async removeFromWishlist(userId, productId) {
    const isWishlisted = await userRepo.isInWishlist(userId, productId);
    if (!isWishlisted) throw ApiError.notFound('Product not in wishlist.');
    await userRepo.removeFromWishlist(userId, productId);
  }

  async clearWishlist(userId) {
    await userRepo.clearWishlist(userId);
  }

  async getDashboard(userId) {
    const prisma = require('../repositories/prismaClient');
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [profile, ordersByStatus, recentOrders, monthlySpend] = await Promise.all([
      userRepo.findById(userId),
      prisma.order.groupBy({
        by: ['status'],
        _count: { id: true },
        where: { userId },
      }),
      prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true, orderNumber: true, status: true,
          totalAmount: true, createdAt: true,
          items: { select: { name: true, quantity: true, thumbnail: true }, take: 1 },
        },
      }),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: {
          userId,
          createdAt: { gte: monthStart },
          status: { notIn: ['cancelled', 'failed'] },
        },
      }),
    ]);

    const totalOrders   = ordersByStatus.reduce((s, r) => s + r._count.id, 0);
    const activeOrders  = ordersByStatus
      .filter(r => ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery'].includes(r.status))
      .reduce((s, r) => s + r._count.id, 0);
    const deliveredOrders = ordersByStatus.find(r => r.status === 'delivered')?._count.id || 0;

    return {
      profile: {
        firstName: profile?.firstName,
        lastName:  profile?.lastName,
        email:     profile?.email,
        avatarUrl: profile?.avatarUrl,
      },
      orders: {
        total:     totalOrders,
        active:    activeOrders,
        delivered: deliveredOrders,
        byStatus:  ordersByStatus.map(r => ({ status: r.status, count: r._count.id })),
      },
      monthlySpend: Number(monthlySpend._sum.totalAmount || 0),
      recentOrders,
    };
  }
}

module.exports = new UserService();
