'use strict';

const userService = require('../services/userService');
const { sendSuccess } = require('../helpers/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { MESSAGES } = require('../constants');

const getProfile = asyncHandler(async (req, res) => {
  const user = await userService.getProfile(req.user.id);
  sendSuccess(res, MESSAGES.FETCHED, user);
});

const updateProfile = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user.id, req.body);
  sendSuccess(res, MESSAGES.UPDATED, user);
});

const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
  const user = await userService.uploadAvatar(req.user.id, req.file);
  sendSuccess(res, 'Avatar updated.', { avatar: user.avatar });
});

const getAddresses = asyncHandler(async (req, res) => {
  const addresses = await userService.getAddresses(req.user.id);
  sendSuccess(res, MESSAGES.FETCHED, addresses);
});

const addAddress = asyncHandler(async (req, res) => {
  const addresses = await userService.addAddress(req.user.id, req.body);
  sendSuccess(res, 'Address added.', addresses, 201);
});

const updateAddress = asyncHandler(async (req, res) => {
  const addresses = await userService.updateAddress(req.user.id, req.params.addressId, req.body);
  sendSuccess(res, 'Address updated.', addresses);
});

const deleteAddress = asyncHandler(async (req, res) => {
  const addresses = await userService.deleteAddress(req.user.id, req.params.addressId);
  sendSuccess(res, 'Address deleted.', addresses);
});

const setDefaultAddress = asyncHandler(async (req, res) => {
  await userService.setDefaultAddress(req.user.id, req.params.addressId);
  sendSuccess(res, 'Default address set.');
});

const getWishlist = asyncHandler(async (req, res) => {
  const wishlist = await userService.getWishlist(req.user.id);
  sendSuccess(res, MESSAGES.FETCHED, wishlist);
});

const toggleWishlist = asyncHandler(async (req, res) => {
  const result = await userService.toggleWishlist(req.user.id, req.params.productId);
  sendSuccess(res, result.wishlisted ? 'Added to wishlist.' : 'Removed from wishlist.', result);
});

const removeFromWishlist = asyncHandler(async (req, res) => {
  await userService.removeFromWishlist(req.user.id, req.params.productId);
  sendSuccess(res, 'Removed from wishlist.');
});

const clearWishlist = asyncHandler(async (req, res) => {
  await userService.clearWishlist(req.user.id);
  sendSuccess(res, 'Wishlist cleared.');
});

module.exports = { getProfile, updateProfile, uploadAvatar, getAddresses, addAddress, updateAddress, deleteAddress, setDefaultAddress, getWishlist, toggleWishlist, removeFromWishlist, clearWishlist };
