'use strict';

const userService = require('../services/userService');
const { sendSuccess } = require('../helpers/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../helpers/ApiError');
const { MESSAGES, HTTP_STATUS } = require('../constants');

const getProfile = asyncHandler(async (req, res) => {
  const user = await userService.getProfile(req.user.id);
  sendSuccess(res, MESSAGES.FETCHED, user);
});

const updateProfile = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user.id, req.body);
  sendSuccess(res, MESSAGES.UPDATED, user);
});

const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded.');
  const user = await userService.uploadAvatar(req.user.id, req.file);
  sendSuccess(res, 'Avatar updated.', { avatar: user.avatar });
});

const lookupPincode = asyncHandler(async (req, res) => {
  const data = await userService.lookupPincode(req.params.pincode);
  sendSuccess(res, 'Location fetched.', data);
});

const getAddresses = asyncHandler(async (req, res) => {
  const addresses = await userService.getAddresses(req.user.id);
  sendSuccess(res, MESSAGES.FETCHED, addresses);
});

const addAddress = asyncHandler(async (req, res) => {
  const addresses = await userService.addAddress(req.user.id, req.body);
  sendSuccess(res, 'Address added.', addresses, HTTP_STATUS.CREATED);
});

const updateAddress = asyncHandler(async (req, res) => {
  const addresses = await userService.updateAddress(req.user.id, req.params.addressId, req.body);
  sendSuccess(res, 'Address updated.', addresses);
});

const deleteAddress = asyncHandler(async (req, res) => {
  await userService.deleteAddress(req.user.id, req.params.addressId);
  sendSuccess(res, 'Address deleted.');
});

const setDefaultAddress = asyncHandler(async (req, res) => {
  const addresses = await userService.setDefaultAddress(req.user.id, req.params.addressId);
  sendSuccess(res, 'Default address set.', addresses);
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

const getDashboard = asyncHandler(async (req, res) => {
  const data = await userService.getDashboard(req.user.id);
  sendSuccess(res, MESSAGES.FETCHED, data);
});

module.exports = { getProfile, updateProfile, uploadAvatar, lookupPincode, getAddresses, addAddress, updateAddress, deleteAddress, setDefaultAddress, getWishlist, toggleWishlist, removeFromWishlist, clearWishlist, getDashboard };
