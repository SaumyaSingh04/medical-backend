'use strict';

const { v2: cloudinary } = require('cloudinary');
const multer = require('multer');
const logger = require('../utils/logger');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

logger.info('✅ Cloudinary configured.');

// Multer memory storage — actual upload happens via uploadBuffer
const cloudinaryStorage = multer.memoryStorage();

/**
 * Delete a Cloudinary resource by public_id
 */
const deleteCloudinaryResource = async (publicId, resourceType = 'image') => {
  try {
    return await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    logger.error('Cloudinary delete error:', err.message);
    throw err;
  }
};

/**
 * Upload a buffer directly to Cloudinary
 */
const uploadBuffer = (buffer, folder, options = {}) =>
  new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: `${process.env.CLOUDINARY_FOLDER || 'medical-ecommerce'}/${folder}`,
          resource_type: 'auto',
          ...options,
        },
        (err, result) => (err ? reject(err) : resolve(result))
      )
      .end(buffer);
  });

module.exports = { cloudinary, cloudinaryStorage, deleteCloudinaryResource, uploadBuffer };
