'use strict';

const blogRepo = require('../repositories/blogRepo');
const { deleteCloudinaryResource } = require('../config/cloudinary');
const ApiError = require('../helpers/ApiError');
const { parsePagination, buildPaginationMeta } = require('../helpers/paginate');
const cacheService = require('./cacheService');
const { CACHE_TTL, MESSAGES } = require('../constants');

class BlogService {
  async listBlogs(queryParams) {
    const { page, limit, skip } = parsePagination(queryParams);
    const filter = await blogRepo.buildFilter(queryParams);

    const [blogs, total] = await Promise.all([
      blogRepo.findPublished(filter, {
        sort: { publishedAt: -1 },
        skip,
        limit,
        populate: [{ path: 'author', select: 'firstName lastName avatar' }],
        select: 'title slug excerpt coverImage author category tags publishedAt views likes isFeatured',
      }),
      blogRepo.count({ ...filter, status: 'published' }),
    ]);

    return { blogs, meta: buildPaginationMeta(total, page, limit) };
  }

  async getBlogBySlug(slug) {
    const cacheKey = `blog:${slug}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      blogRepo.incrementViews(cached.id).catch(() => {});
      return cached;
    }

    const blog = await blogRepo.findBySlug(slug);
    if (!blog) throw ApiError.notFound(MESSAGES.BLOG_NOT_FOUND);

    blogRepo.incrementViews(blog.id).catch(() => {});
    const { views: _v, ...blogToCache } = blog;
    await cacheService.set(cacheKey, blogToCache, CACHE_TTL.BLOG_DETAIL);
    return blog;
  }

  async getBlogByIdAdmin(id) {
    const blog = await blogRepo.findById(id, {
      populate: [{ path: 'author', select: 'firstName lastName avatar' }],
    });
    if (!blog) throw ApiError.notFound(MESSAGES.BLOG_NOT_FOUND);
    return blog;
  }

  async createBlog(data, file, userId) {
    if (file) {
      data.coverImage = { url: file.path, publicId: file.filename, alt: data.title };
    }
    data.author = userId;
    const blog = await blogRepo.create(data);
    await cacheService.invalidatePattern('blogs:*');
    return blog;
  }

  async updateBlog(id, data, file) {
    const blog = await blogRepo.findById(id);
    if (!blog) throw ApiError.notFound(MESSAGES.BLOG_NOT_FOUND);

    if (file) {
      if (blog.coverImage?.publicId) {
        await deleteCloudinaryResource(blog.coverImage.publicId).catch(() => {});
      }
      data.coverImage = { url: file.path, publicId: file.filename, alt: data.title || blog.title };
    }

    if (data.status === 'published' && blog.status !== 'published') {
      data.publishedAt = new Date();
    }

    const updated = await blogRepo.updateById(id, data, { new: true, runValidators: true });
    await cacheService.del(`blog:${blog.slug}`);
    await cacheService.invalidatePattern('blogs:*');
    return updated;
  }

  async deleteBlog(id) {
    const blog = await blogRepo.findById(id);
    if (!blog) throw ApiError.notFound(MESSAGES.BLOG_NOT_FOUND);

    if (blog.coverImage?.publicId) {
      await deleteCloudinaryResource(blog.coverImage.publicId).catch(() => {});
    }

    await blogRepo.deleteById(id);
    await cacheService.del(`blog:${blog.slug}`);
    await cacheService.invalidatePattern('blogs:*');
    return { message: MESSAGES.DELETED };
  }

  async publishBlog(id) {
    const blog = await blogRepo.findById(id);
    if (!blog) throw ApiError.notFound(MESSAGES.BLOG_NOT_FOUND);
    if (blog.status === 'published') throw ApiError.conflict('Blog is already published.');

    const updated = await blogRepo.updateById(id, {
      status: 'published',
      publishedAt: new Date(),
    }, { new: true });

    await cacheService.invalidatePattern('blogs:*');
    return updated;
  }

  async unpublishBlog(id) {
    const blog = await blogRepo.findById(id);
    if (!blog) throw ApiError.notFound(MESSAGES.BLOG_NOT_FOUND);

    const updated = await blogRepo.updateById(id, { status: 'draft' }, { new: true });
    await cacheService.del(`blog:${blog.slug}`);
    await cacheService.invalidatePattern('blogs:*');
    return updated;
  }

  async searchBlogs(q, queryParams) {
    const { page, limit, skip } = parsePagination(queryParams);
    const filter = await blogRepo.buildFilter(queryParams);

    const [blogs, total] = await Promise.all([
      blogRepo.search(q, filter, skip, limit),
      blogRepo.count({ ...filter, status: 'published' }),
    ]);

    return { blogs, meta: buildPaginationMeta(total, page, limit) };
  }

  async getFeaturedBlogs(limit = 6) {
    return blogRepo.findPublished({ isFeatured: true }, {
      limit,
      sort: { publishedAt: -1 },
      populate: [{ path: 'author', select: 'firstName lastName avatar' }],
      select: 'title slug excerpt coverImage author category tags publishedAt views likes',
    });
  }

  async listAllAdmin(queryParams) {
    const { page, limit, skip } = parsePagination(queryParams);
    const filter = {};
    if (queryParams.status) filter.status = queryParams.status;
    if (queryParams.author) filter.author = queryParams.author;

    const [blogs, total] = await Promise.all([
      blogRepo.findAll(filter, {
        sort: { createdAt: -1 },
        skip,
        limit,
        populate: [{ path: 'author', select: 'firstName lastName' }],
        select: 'title slug status author category publishedAt views likes isFeatured createdAt',
      }),
      blogRepo.count(filter),
    ]);

    return { blogs, meta: buildPaginationMeta(total, page, limit) };
  }

  async likeBlog(id) {
    const exists = await blogRepo.findById(id);
    if (!exists) throw ApiError.notFound(MESSAGES.BLOG_NOT_FOUND);
    return blogRepo.toggleLike(id, true);
  }
}

module.exports = new BlogService();
