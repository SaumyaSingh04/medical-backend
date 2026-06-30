'use strict';

const searchRepo = require('../repositories/searchRepo');
const ApiError   = require('../helpers/ApiError');

class SearchService {
  /**
   * Universal search — runs products, categories, blogs in parallel.
   * Returns grouped results with counts.
   */
  async universalSearch(q, { productLimit = 10, categoryLimit = 5, blogLimit = 5 } = {}) {
    if (!q || !q.trim()) throw ApiError.badRequest('Search query is required.');

    const query = q.trim();

    const [rawProducts, rawCategories, rawBlogs] = await Promise.all([
      searchRepo.searchProducts(query, { limit: productLimit }),
      searchRepo.searchCategories(query, { limit: categoryLimit }),
      searchRepo.searchBlogs(query, { limit: blogLimit }),
    ]);

    const products = rawProducts.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      thumbnail: p.thumbnailUrl ? { url: p.thumbnailUrl } : null,
      brand: p.brand,
      stock: p.stock,
      averageRating: p.averageRating,
      ratingCount: p.ratingCount,
      category: p.category
        ? { id: p.category.id, name: p.category.name, slug: p.category.slug }
        : null,
    }));

    const categories = rawCategories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      image: c.imageUrl ? { url: c.imageUrl } : null,
      level: c.level,
      parentId: c.parentId,
    }));

    const blogs = rawBlogs.map((b) => ({
      id: b.id,
      title: b.title,
      slug: b.slug,
      excerpt: b.excerpt,
      coverImage: b.coverImageUrl ? { url: b.coverImageUrl } : null,
      publishedAt: b.publishedAt,
      category: b.category,
      tags: b.tags,
    }));

    return {
      query,
      results: { products, categories, blogs },
      counts: {
        products: products.length,
        categories: categories.length,
        blogs: blogs.length,
        total: products.length + categories.length + blogs.length,
      },
    };
  }

  /**
   * Autocomplete suggestions — fast, lightweight, product names + category names.
   * Used for search-as-you-type dropdowns.
   */
  async getSuggestions(q) {
    if (!q || !q.trim()) throw ApiError.badRequest('Search query is required.');
    if (q.trim().length < 2) throw ApiError.badRequest('Minimum 2 characters required.');

    const { products, categories } = await searchRepo.getSuggestions(q.trim());

    const suggestions = [
      ...categories.map((c) => ({ type: 'category', id: c.id, label: c.name, slug: c.slug })),
      ...products.map((p) => ({
        type: 'product',
        id: p.id,
        label: p.name,
        slug: p.slug,
        thumbnail: p.thumbnailUrl ? { url: p.thumbnailUrl } : null,
        price: p.price,
      })),
    ];

    return { query: q.trim(), suggestions };
  }
}

module.exports = new SearchService();
