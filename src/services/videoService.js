'use strict';

const videoRepo = require('../repositories/videoRepo');
const cartService = require('./cartService');
const ApiError = require('../helpers/ApiError');
const { deleteCloudinaryResource } = require('../config/cloudinary');
const { MESSAGES } = require('../constants');

const getActiveVideos = () => videoRepo.findAll({ isActive: true });

const getAllVideosAdmin = () => videoRepo.findAll();

const getVideoById = async (id) => {
  const video = await videoRepo.findById(id);
  if (!video) throw ApiError.notFound(MESSAGES.VIDEO_NOT_FOUND);
  return video;
};

const createVideo = async (body, files) => {
  const { productId, sortOrder, isActive } = body;
  const title = body.title?.trim();

  if (!title) throw ApiError.badRequest('Title is required.');

  const videoFile = files?.video?.[0];
  const thumbnailFile = files?.thumbnail?.[0];

  if (!videoFile) throw ApiError.badRequest('Video file is required.');

  const parsedSortOrder = parseInt(sortOrder, 10);

  const data = {
    title,
    videoUrl: videoFile.path,
    videoPublicId: videoFile.filename || null,
    thumbnailUrl: thumbnailFile?.path || null,
    thumbnailPublicId: thumbnailFile?.filename || null,
    sortOrder: !isNaN(parsedSortOrder) ? parsedSortOrder : 0,
    isActive: isActive !== undefined ? isActive === 'true' || isActive === true : true,
  };

  if (productId) data.productId = productId;

  return videoRepo.create(data);
};

const updateVideo = async (id, body, files) => {
  const existing = await videoRepo.findById(id);
  if (!existing) throw ApiError.notFound(MESSAGES.VIDEO_NOT_FOUND);

  const videoFile = files?.video?.[0];
  const thumbnailFile = files?.thumbnail?.[0];

  const data = {};

  if (body.title !== undefined) data.title = body.title.trim();
  if (body.productId !== undefined) data.productId = body.productId || null;
  if (body.sortOrder !== undefined) {
    const parsedSortOrder = parseInt(body.sortOrder, 10);
    data.sortOrder = !isNaN(parsedSortOrder) ? parsedSortOrder : 0;
  }
  if (body.isActive !== undefined) data.isActive = body.isActive === 'true' || body.isActive === true;

  if (videoFile) {
    // Delete old video from Cloudinary
    if (existing.videoPublicId) {
      await deleteCloudinaryResource(existing.videoPublicId, 'video').catch(() => null);
    }
    data.videoUrl = videoFile.path;
    data.videoPublicId = videoFile.filename || null;
  }

  if (thumbnailFile) {
    // Delete old thumbnail from Cloudinary
    if (existing.thumbnailPublicId) {
      await deleteCloudinaryResource(existing.thumbnailPublicId, 'image').catch(() => null);
    }
    data.thumbnailUrl = thumbnailFile.path;
    data.thumbnailPublicId = thumbnailFile.filename || null;
  }

  return videoRepo.update(id, data);
};

const deleteVideo = async (id) => {
  const existing = await videoRepo.findById(id);
  if (!existing) throw ApiError.notFound(MESSAGES.VIDEO_NOT_FOUND);

  // Delete from Cloudinary
  if (existing.videoPublicId) {
    await deleteCloudinaryResource(existing.videoPublicId, 'video').catch(() => null);
  }
  if (existing.thumbnailPublicId) {
    await deleteCloudinaryResource(existing.thumbnailPublicId, 'image').catch(() => null);
  }

  await videoRepo.remove(id);
  return { message: MESSAGES.VIDEO_DELETED };
};

const reorderVideos = async (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('items array is required for reorder.');
  }
  return videoRepo.reorder(items);
};

// Video section se product ko cart mein add karo
const addVideoProductToCart = async (videoId, userId, { variantId, quantity = 1 } = {}) => {
  const video = await videoRepo.findById(videoId);
  if (!video) throw ApiError.notFound(MESSAGES.VIDEO_NOT_FOUND);
  if (!video.productId) throw ApiError.badRequest('This video has no linked product.');

  const parsedQty = parseInt(quantity, 10);
  const safeQty = (!isNaN(parsedQty) && parsedQty > 0) ? parsedQty : 1;

  return cartService.addItem(userId, {
    productId: video.productId,
    variantId: variantId || undefined,
    quantity: safeQty,
  });
};

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
