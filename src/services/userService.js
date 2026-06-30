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
    const { firstName, lastName, phone, email, password } = updateData;
    const updateObj = { firstName, lastName, phone, email };
    
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
    const user = await userRepo.findById(userId);
    return user?.wishlist || [];
  }

  async toggleWishlist(userId, productId) {
    const user = await userRepo.findById(userId, { select: 'wishlist' });
    if (!user) throw ApiError.notFound('User not found.');

    const isWishlisted = user.wishlist.some((id) => id.toString() === productId);
    if (isWishlisted) {
      await userRepo.removeFromWishlist(userId, productId);
      return { wishlisted: false };
    } else {
      await userRepo.addToWishlist(userId, productId);
      return { wishlisted: true };
    }
  }
}

module.exports = new UserService();
