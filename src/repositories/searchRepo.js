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
   * Search suggestions — just product names + category names for autocomplete
   */
  async getSuggestions(q, { limit = 8 } = {}) {
    const [products, categories] = await Promise.all([
      prisma.product.findMany({
        where: {
          isActive: true,
          name: { contains: q, mode: 'insensitive' },
        },
        select: { id: true, name: true, slug: true, thumbnailUrl: true, price: true },
        orderBy: { totalSold: 'desc' },
        take: limit,
      }),
      prisma.category.findMany({
        where: {
          isActive: true,
          name: { contains: q, mode: 'insensitive' },
        },
        select: { id: true, name: true, slug: true },
        orderBy: { sortOrder: 'asc' },
        take: 3,
      }),
    ]);

    return { products, categories };
  }
}

module.exports = new SearchRepository();
