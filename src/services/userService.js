'use strict';

const axios = require('axios');
const userRepo = require('../repositories/userRepo');
const productRepo = require('../repositories/productRepo');
const orderRepo = require('../repositories/orderRepo');
const { deleteCloudinaryResource } = require('../config/cloudinary');
const ApiError = require('../helpers/ApiError');
const { ORDER_STATUS } = require('../constants');

const ACTIVE_ORDER_STATUSES = new Set([
  ORDER_STATUS.PENDING,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.OUT_FOR_DELIVERY,
]);

class UserService {
  async getProfile(userId) {
    const user = await userRepo.findById(userId);
    if (!user) throw ApiError.notFound('User not found.');
    return user;
  }

  async updateProfile(userId, updateData) {
    const { firstName, lastName, phone, password, currentPassword } = updateData;

    if (password) {
      const user = await userRepo.findById(userId);
      if (!user) throw ApiError.notFound('User not found.');
      if (!user.password) throw ApiError.badRequest('Password change not allowed for Google-only accounts.');
      const isMatch = await user.comparePassword(currentPassword || '');
      if (!isMatch) throw ApiError.unauthorized('Current password is incorrect.');
    }

    const updateObj = Object.fromEntries(
      Object.entries({ firstName, lastName, phone, password }).filter(([, v]) => v !== undefined)
    );
    const user = await userRepo.updateById(userId, updateObj);
    if (!user) throw ApiError.notFound('User not found.');
    return user.toPublicJSON ? user.toPublicJSON() : user;
  }

  async uploadAvatar(userId, file) {
    const user = await userRepo.findById(userId);
    if (!user) throw ApiError.notFound('User not found.');
    if (user.avatar?.publicId) await deleteCloudinaryResource(user.avatar.publicId).catch(() => {});
    return userRepo.updateById(userId, { avatar: { url: file.path, publicId: file.filename } });
  }

  async lookupPincode(pincode) {
    try {
      const { data } = await axios.get(
        `https://api.postalpincode.in/pincode/${pincode}`,
        { timeout: 5000 }
      );
      const result = Array.isArray(data) && data[0];
      if (!result || result.Status !== 'Success' || !result.PostOffice?.length) {
        throw ApiError.notFound('No location found for this pincode.');
      }
      const post = result.PostOffice[0];
      return {
        pincode,
        city:    post.District,
        state:   post.State,
        country: 'India',
        postOffices: result.PostOffice.map((p) => ({
          name:     p.Name,
          district: p.District,
          state:    p.State,
          block:    p.Block,
        })),
      };
    } catch (err) {
      if (err.statusCode) throw err;
      throw ApiError.badRequest('Pincode lookup failed. Please enter city and state manually.');
    }
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
    const product = await productRepo.findById(productId);
    if (!product) throw ApiError.notFound('Product not found.');

    const wishlist = await userRepo.getWishlist(userId);
    const pid = String(productId);
    const isWishlisted = wishlist?.items?.some((item) => String(item.productId) === pid) ?? false;

    if (isWishlisted) {
      const filtered = (wishlist.items || [])
        .filter((item) => String(item.productId) !== pid)
        .map((item) => ({ productId: String(item.productId), addedAt: item.addedAt }));
      await userRepo.updateWishlistItems(userId, filtered);
      return { wishlisted: false, productId };
    }

    await userRepo.addToWishlist(userId, productId);
    return { wishlisted: true, productId };
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
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [profile, ordersByStatus, recentOrders, monthlySpend] = await Promise.all([
      userRepo.findById(userId),
      orderRepo.getStatusGroupByUser(userId),
      orderRepo.getRecentByUser(userId, 5),
      orderRepo.getMonthlySpend(userId, monthStart),
    ]);

    const totalOrders     = ordersByStatus.reduce((s, r) => s + r.count, 0);
    const activeOrders    = ordersByStatus.filter((r) => ACTIVE_ORDER_STATUSES.has(r.status)).reduce((s, r) => s + r.count, 0);
    const deliveredOrders = ordersByStatus.find((r) => r.status === ORDER_STATUS.DELIVERED)?.count || 0;

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
        byStatus:  ordersByStatus,
      },
      monthlySpend,
      recentOrders,
    };
  }
}

module.exports = new UserService();
