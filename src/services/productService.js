'use strict';

const productRepo = require('../repositories/productRepo');
const { categoryRepo } = require('../repositories');
const { deleteCloudinaryResource } = require('../config/cloudinary');
const ApiError = require('../helpers/ApiError');
const { parsePagination, buildPaginationMeta, buildSort } = require('../helpers/paginate');
const cacheService = require('./cacheService');
const { CACHE_TTL, MESSAGES } = require('../constants');

class ProductService {
  async listProducts(queryParams) {
    const { page, limit, skip } = parsePagination(queryParams);
    const sort = buildSort(queryParams.sort, '-createdAt');
    const filter = await productRepo.buildFilter(queryParams);

    const [products, total] = await Promise.all([
      productRepo.findAll(filter, {
        sort, skip, limit,
        select: 'name slug price compareAtPrice thumbnail averageRating ratingCount stock isFeatured isActive brand category subcategory createdAt',
        populate: [{ path: 'category' }, { path: 'subcategory' }],
      }),
      productRepo.count(filter),
    ]);

    return { products, meta: buildPaginationMeta(total, page, limit) };
  }

  async getProductBySlug(slug) {
    const cacheKey = `product:slug:${slug}`;
    return cacheService.remember(cacheKey, CACHE_TTL.PRODUCT_DETAIL, async () => {
      const product = await productRepo.findOne({ slug, isActive: true }, {
        populate: [
          { path: 'category', select: 'name slug' },
          { path: 'subcategory', select: 'name slug' },
        ],
      });
      if (!product) throw ApiError.notFound(MESSAGES.PRODUCT_NOT_FOUND);
      return product;
    });
  }

  async getProductById(id) {
    const product = await productRepo.findById(id, {
      populate: [{ path: 'category', select: 'name slug' }],
    });
    if (!product) throw ApiError.notFound(MESSAGES.PRODUCT_NOT_FOUND);
    return product;
  }

  async createProduct(data, files) {
    const images = files?.map((f) => ({ url: f.path, publicId: f.filename })) || [];
    const product = await productRepo.create({ ...data, images, thumbnail: images[0] || null });
    await cacheService.invalidatePattern('products:*');
    return product;
  }

  async updateProduct(id, data, files) {
    const product = await productRepo.findById(id);
    if (!product) throw ApiError.notFound(MESSAGES.PRODUCT_NOT_FOUND);

    if (files?.length) {
      const newImages = files.map((f) => ({ url: f.path, publicId: f.filename }));
      data.images = [...(product.images || []), ...newImages];
    }

    // Normalise string booleans from multipart/form-data
    if (data.isActive   !== undefined) data.isActive   = data.isActive   === true || data.isActive   === 'true';
    if (data.isFeatured !== undefined) data.isFeatured = data.isFeatured === true || data.isFeatured === 'true';

    const updated = await productRepo.updateById(id, data);
    const cacheInvalidations = [cacheService.del(`product:slug:${product.slug}`)];
    // If slug changed, also bust the new slug key.
    if (data.slug && data.slug !== product.slug) {
      cacheInvalidations.push(cacheService.del(`product:slug:${data.slug}`));
    }
    await Promise.all(cacheInvalidations);
    return updated;
  }

  async deleteProduct(id) {
    const product = await productRepo.findById(id);
    if (!product) throw ApiError.notFound(MESSAGES.PRODUCT_NOT_FOUND);

    // Delete images from Cloudinary
    await Promise.all(
      (product.images || []).filter((img) => img.publicId)
        .map((img) => deleteCloudinaryResource(img.publicId).catch(() => {}))
    );

    await productRepo.deleteById(id);
    await Promise.all([
      cacheService.del(`product:slug:${product.slug}`),
      cacheService.invalidatePattern('products:*'),
    ]);
    return { message: MESSAGES.DELETED };
  }

  async deleteProductImage(productId, publicId) {
    await deleteCloudinaryResource(publicId).catch(() => {});
    return productRepo.removeImage(productId, publicId);
  }

  async getFeaturedProducts(limit = 6) {
    const opts = {
      limit,
      sort: { averageRating: -1, ratingCount: -1 },
      select: 'name slug price compareAtPrice thumbnail averageRating ratingCount stock isFeatured category',
      populate: [{ path: 'category', select: 'name slug' }],
    };
    const featured = await productRepo.findAll({ isFeatured: true, isActive: true }, opts);
    if (featured.length > 0) return featured;
    return productRepo.findAll({ isActive: true }, opts);
  }
}

module.exports = new ProductService();
