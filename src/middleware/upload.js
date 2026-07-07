'use strict';

const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { cloudinaryStorage, uploadBuffer } = require('../config/cloudinary');
const ApiError = require('../helpers/ApiError');
const { UPLOAD } = require('../constants');

const MIME_TO_EXT = {
  'image/jpeg':    ['.jpg', '.jpeg'],
  'image/png':     ['.png'],
  'image/webp':    ['.webp'],
  'video/mp4':     ['.mp4'],
  'video/webm':    ['.webm'],
  'video/quicktime': ['.mov'],
  'video/x-msvideo': ['.avi'],
};

// Strips directory components and replaces unsafe characters (CWE-22/23 fix).
function sanitizeFilename(filename) {
  return path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
}

// Returns only the extension component, sanitized — never uses originalname raw.
function safeExt(originalname) {
  return path.extname(sanitizeFilename(originalname)).toLowerCase();
}

function extensionMatchesMime(originalname, mimetype) {
  const allowed = MIME_TO_EXT[mimetype];
  return allowed ? allowed.includes(safeExt(originalname)) : false;
}

const isCloudinaryConfigured = () => {
  const { CLOUDINARY_CLOUD_NAME: name, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
  return (
    name && name !== 'your_cloud_name' &&
    key  && key  !== 'your_api_key'   &&
    secret && secret !== 'your_api_secret'
  );
};

const getLocalStorage = (folder) => {
  const uploadDir = path.join(__dirname, '..', '..', 'uploads', folder);
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      // CWE-22/23 fix: use safeExt — never pass file.originalname directly into the path.
      const ext = safeExt(file.originalname);
      cb(null, `${file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  });
};

const makeFileFilter = (allowedMimes, errorMsg) => (req, file, cb) => {
  if (!allowedMimes.includes(file.mimetype)) {
    return cb(ApiError.badRequest(errorMsg), false);
  }
  if (!extensionMatchesMime(file.originalname, file.mimetype)) {
    return cb(ApiError.badRequest('File extension does not match its content type.'), false);
  }
  cb(null, true);
};

const fileFilter = makeFileFilter(
  UPLOAD.ALLOWED_MIME_TYPES,
  'Invalid file type. Only JPEG, PNG, and WebP are allowed.',
);

const videoFileFilter = makeFileFilter(
  [...UPLOAD.ALLOWED_MIME_TYPES, ...UPLOAD.ALLOWED_VIDEO_MIME_TYPES],
  'Invalid file type. Only MP4, WebM, MOV, AVI and images are allowed.',
);

const uploadFileToCloudinary = async (file, folder) => {
  const isVideo = UPLOAD.ALLOWED_VIDEO_MIME_TYPES.includes(file.mimetype);
  const base = `${process.env.CLOUDINARY_FOLDER || 'medical-ecommerce'}/${folder}`;
  const options = isVideo
    ? { folder: base, resource_type: 'video', allowed_formats: ['mp4', 'webm', 'mov', 'avi'] }
    : { folder: base, resource_type: 'image', allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 1200, crop: 'limit', quality: 'auto:good' }] };
  const result = await uploadBuffer(file.buffer, folder, options);
  file.path     = result.secure_url;
  file.filename = result.public_id;
  return file;
};

// Flatten req.files regardless of whether it's an array or fields object.
function flatFiles(req) {
  if (!req.files) return [];
  return Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
}

const makeDynamicUpload = (folder, options = {}) => {
  const isCloudy = isCloudinaryConfigured();
  const storage  = isCloudy ? cloudinaryStorage : getLocalStorage(folder);
  const uploader = multer({
    storage,
    limits:     options.limits     || { fileSize: UPLOAD.MAX_SIZE_BYTES },
    fileFilter: options.fileFilter || fileFilter,
  });

  const mapFiles = async (req) => {
    if (isCloudy) {
      if (req.file) await uploadFileToCloudinary(req.file, folder);
      await Promise.all(flatFiles(req).map((f) => uploadFileToCloudinary(f, folder)));
    } else {
      const remap = (f) => {
        if (f.path && !f.path.startsWith('http'))
          f.path = `/uploads/${folder}/${sanitizeFilename(f.filename)}`;
      };
      if (req.file) remap(req.file);
      flatFiles(req).forEach(remap);
    }
  };

  const wrap = (method) => (...args) => (req, res, next) => {
    uploader[method](...args)(req, res, async (err) => {
      if (err) return next(err);
      try { await mapFiles(req); next(); } catch (e) { next(e); }
    });
  };

  return {
    single: wrap('single'),
    array:  wrap('array'),
    fields: wrap('fields'),
    any:    wrap('any'),
  };
};

const productUpload  = makeDynamicUpload('products',    { limits: { fileSize: UPLOAD.MAX_SIZE_BYTES, files: UPLOAD.MAX_PRODUCT_IMAGES } });
const avatarUpload   = makeDynamicUpload('avatars',     { limits: { fileSize: 2 * 1024 * 1024 } });
const categoryUpload = makeDynamicUpload('categories',  { limits: { fileSize: UPLOAD.MAX_SIZE_BYTES } });
const reviewUpload   = makeDynamicUpload('reviews',     { limits: { fileSize: UPLOAD.MAX_SIZE_BYTES, files: 5 } });
const blogUpload     = makeDynamicUpload('blogs',       { limits: { fileSize: UPLOAD.MAX_SIZE_BYTES } });
const videoUpload    = makeDynamicUpload('home-videos', { limits: { fileSize: UPLOAD.VIDEO_MAX_SIZE_BYTES }, fileFilter: videoFileFilter });

const handleMulterError = (err, req, res, next) => {
  if (!(err instanceof multer.MulterError)) return next(err);
  if (err.code === 'LIMIT_FILE_SIZE')  return next(ApiError.badRequest(`File too large. Max size: ${UPLOAD.MAX_SIZE_MB}MB`));
  if (err.code === 'LIMIT_FILE_COUNT') return next(ApiError.badRequest(`Too many files. Max: ${UPLOAD.MAX_PRODUCT_IMAGES}`));
  return next(ApiError.badRequest(`Upload error: ${err.message}`));
};

module.exports = { productUpload, avatarUpload, categoryUpload, reviewUpload, blogUpload, videoUpload, handleMulterError };
