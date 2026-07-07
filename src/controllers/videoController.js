'use strict';

const videoService = require('../services/videoService');
const { sendSuccess } = require('../helpers/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { MESSAGES, HTTP_STATUS } = require('../constants');

const getActiveVideos = asyncHandler(async (req, res) => {
  sendSuccess(res, MESSAGES.FETCHED, await videoService.getActiveVideos());
});

const getAllVideosAdmin = asyncHandler(async (req, res) => {
  sendSuccess(res, MESSAGES.FETCHED, await videoService.getAllVideosAdmin());
});

const getVideoById = asyncHandler(async (req, res) => {
  sendSuccess(res, MESSAGES.FETCHED, await videoService.getVideoById(req.params.id));
});

const createVideo = asyncHandler(async (req, res) => {
  sendSuccess(res, MESSAGES.VIDEO_CREATED, await videoService.createVideo(req.body, req.files), HTTP_STATUS.CREATED);
});

const updateVideo = asyncHandler(async (req, res) => {
  sendSuccess(res, MESSAGES.VIDEO_UPDATED, await videoService.updateVideo(req.params.id, req.body, req.files));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const result = await videoService.deleteVideo(req.params.id);
  sendSuccess(res, result.message);
});

const reorderVideos = asyncHandler(async (req, res) => {
  sendSuccess(res, MESSAGES.UPDATED, await videoService.reorderVideos(req.body.items));
});

const addVideoProductToCart = asyncHandler(async (req, res) => {
  const cart = await videoService.addVideoProductToCart(req.params.videoId, req.user.id, req.body);
  sendSuccess(res, MESSAGES.CART_ITEM_ADDED, cart);
});

module.exports = {
  getActiveVideos, getAllVideosAdmin, getVideoById,
  createVideo, updateVideo, deleteVideo, reorderVideos, addVideoProductToCart,
};
