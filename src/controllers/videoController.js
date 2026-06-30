'use strict';

const videoService = require('../services/videoService');
const { sendSuccess } = require('../helpers/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { MESSAGES, HTTP_STATUS } = require('../constants');

// Public: home page pe active videos fetch karo
const getActiveVideos = asyncHandler(async (req, res) => {
  const videos = await videoService.getActiveVideos();
  sendSuccess(res, MESSAGES.FETCHED, videos);
});

// Admin: sab videos (active + inactive)
const getAllVideosAdmin = asyncHandler(async (req, res) => {
  const videos = await videoService.getAllVideosAdmin();
  sendSuccess(res, MESSAGES.FETCHED, videos);
});

// Admin: single video by id
const getVideoById = asyncHandler(async (req, res) => {
  const video = await videoService.getVideoById(req.params.id);
  sendSuccess(res, MESSAGES.FETCHED, video);
});

// Admin: naya video create karo
const createVideo = asyncHandler(async (req, res) => {
  const video = await videoService.createVideo(req.body, req.files);
  sendSuccess(res, MESSAGES.VIDEO_CREATED, video, HTTP_STATUS.CREATED);
});

// Admin: video update karo
const updateVideo = asyncHandler(async (req, res) => {
  const video = await videoService.updateVideo(req.params.id, req.body, req.files);
  sendSuccess(res, MESSAGES.VIDEO_UPDATED, video);
});

// Admin: video delete karo
const deleteVideo = asyncHandler(async (req, res) => {
  const result = await videoService.deleteVideo(req.params.id);
  sendSuccess(res, result.message);
});

// Admin: sort order update karo
const reorderVideos = asyncHandler(async (req, res) => {
  const videos = await videoService.reorderVideos(req.body.items);
  sendSuccess(res, MESSAGES.UPDATED, videos);
});

// Authenticated user: video section se product cart mein add karo
const addVideoProductToCart = asyncHandler(async (req, res) => {
  const cart = await videoService.addVideoProductToCart(
    req.params.videoId,
    req.user.id,
    req.body
  );
  sendSuccess(res, MESSAGES.CART_ITEM_ADDED, cart);
});

module.exports = {
  getActiveVideos,
  getAllVideosAdmin,
  getVideoById,
  createVideo,
  updateVideo,
  deleteVideo,
  reorderVideos,
  addVideoProductToCart,
};
