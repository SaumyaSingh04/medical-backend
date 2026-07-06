'use strict';

const prisma = require('./prismaClient');

class SearchRepository {
  /**
   * Search products by name, description, brand, tags
   */
  async searchProducts(q, { limit = 5 } = {}) {
    return prisma.product.findMany({
      where: {
        isActive: true,
        isDeleted: false,
        OR: [
          { name:        { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { brand:       { contains: q, mode: 'insensitive' } },
          { tags:        { hasSome: [q.toLowerCase()] } },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        compareAtPrice: true,
        thumbnailUrl: true,
        brand: true,
        stock: true,
        averageRating: true,
        ratingCount: true,
        category: { select: { id: true, name: true, slug: true } },
      },
      orderBy: [{ totalSold: 'desc' }, { averageRating: 'desc' }],
      take: limit,
    });
  }

  /**
   * Search categories by name
   */
  async searchCategories(q, { limit = 3 } = {}) {
    return prisma.category.findMany({
      where: {
        isActive: true,
        isDeleted: false,
        OR: [
          { name:        { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        imageUrl: true,
        level: true,
        parentId: true,
      },
      orderBy: { sortOrder: 'asc' },
      take: limit,
    });
  }

  /**
   * Search blogs by title, excerpt, tags
   */
  async searchBlogs(q, { limit = 3 } = {}) {
    return prisma.blog.findMany({
      where: {
        status: 'published',
        isDeleted: false,
        OR: [
          { title:   { contains: q, mode: 'insensitive' } },
          { excerpt: { contains: q, mode: 'insensitive' } },
          { tags:    { hasSome: [q.toLowerCase()] } },
        ],
      },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverImageUrl: true,
        publishedAt: true,
        category: true,
        tags: true,
      },
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Admin global search — users, orders, leads (never exposed to public)
   */
  async searchAdmin(q, { limit = 5 } = {}) {
    const [users, orders, leads] = await Promise.all([
      prisma.user.findMany({
        where: {
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName:  { contains: q, mode: 'insensitive' } },
            { email:     { contains: q, mode: 'insensitive' } },
            { phone:     { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true },
        take: limit,
      }),
      prisma.order.findMany({
        where: {
          OR: [
            { orderNumber: { contains: q, mode: 'insensitive' } },
            { shippingFullName: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, orderNumber: true, status: true, totalAmount: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.lead.findMany({
        where: {
          isDeleted: false,
          OR: [
            { name:  { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, phone: true, email: true, status: true, source: true },
        take: limit,
      }),
    ]);
    return { users, orders, leads };
  }

  /**
   * Search suggestions — just product names + category names for autocomplete
   */
  async getSuggestions(q, { limit = 8 } = {}) {
    const [products, categories] = await Promise.all([
      prisma.product.findMany({
        where: {
          isActive: true,
          isDeleted: false,
          name: { contains: q, mode: 'insensitive' },
        },
        select: { id: true, name: true, slug: true, thumbnailUrl: true, price: true },
        orderBy: { totalSold: 'desc' },
        take: limit,
      }),
      prisma.category.findMany({
        where: {
          isActive: true,
          isDeleted: false,
          name: { contains: q, mode: 'insensitive' },
        },
        select: { id: true, name: true, slug: true },
        orderBy: { sortOrder: 'asc' },
        take: 3,
      }),
    ]);

    return { products, categories };
  }

  async searchCoupons(q, { limit = 5 } = {}) {
    return prisma.coupon.findMany({
      where: {
        isActive: true,
        isDeleted: false,
        OR: [
          { code:        { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, code: true, type: true, value: true, endDate: true, description: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async searchVideos(q, { limit = 5 } = {}) {
    return prisma.homeVideo.findMany({
      where: {
        isActive: true,
        title: { contains: q, mode: 'insensitive' },
      },
      select: {
        id: true,
        title: true,
        thumbnailUrl: true,
        videoUrl: true,
        productId: true,
      },
      orderBy: { sortOrder: 'asc' },
      take: limit,
    });
  }
}

module.exports = new SearchRepository();
