'use strict';

const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const prisma = require('./prismaClient');

function toMongo(row) {
  if (!row) return null;
  const { id, avatarUrl, avatarPublicId, ...rest } = row;
  return {
    ...rest,
    _id: id,
    id,
    avatar: avatarUrl ? { url: avatarUrl, publicId: avatarPublicId ?? null } : undefined,
    toPublicJSON() {
      const { password, otp, otpExpiry, otpAttempts, refreshTokens, passwordResetToken,
              passwordResetExpiry, loginAttempts, lockUntil, ...pub } = this;
      return pub;
    },
    async comparePassword(plain) {
      return bcrypt.compare(plain, this.password || '');
    },
  };
}

function toPrismaData(data) {
  const { avatar, _id, __v, id: _id2, ...rest } = data;
  const out = { ...rest };
  if (avatar !== undefined) {
    out.avatarUrl = avatar?.url ?? null;
    out.avatarPublicId = avatar?.publicId ?? null;
  }
  return out;
}

function toWhere(filter = {}) {
  const where = {};
  for (const [k, v] of Object.entries(filter)) {
    if (k === '_id' || k === 'id') { where.id = v; continue; }
    where[k] = v;
  }
  return where;
}

function toOrderBy(sort) {
  if (!sort) return [{ createdAt: 'desc' }];
  if (typeof sort === 'string') {
    const field = sort.startsWith('-') ? sort.slice(1) : sort;
    return [{ [field]: sort.startsWith('-') ? 'desc' : 'asc' }];
  }
  return Object.entries(sort).map(([k, v]) => ({ [k]: v === -1 || v === 'desc' ? 'desc' : 'asc' }));
}

class UserRepository {
  async findById(id) {
    const row = await prisma.user.findUnique({ where: { id } });
    return toMongo(row);
  }

  async findOne(filter) {
    const row = await prisma.user.findFirst({ where: toWhere(filter) });
    return toMongo(row);
  }

  async findAll(filter = {}, options = {}) {
    const { sort = { createdAt: -1 }, skip = 0, limit = 20 } = options;
    const rows = await prisma.user.findMany({
      where: toWhere(filter),
      orderBy: toOrderBy(sort),
      skip,
      take: limit,
    });
    return rows.map(toMongo);
  }

  async count(filter = {}) {
    return prisma.user.count({ where: toWhere(filter) });
  }

  async create(data) {
    const out = toPrismaData(data);
    // Normalize email to lowercase before storing
    if (out.email) out.email = out.email.toLowerCase();
    if (out.password) {
      const salt = await bcrypt.genSalt(12);
      out.password = await bcrypt.hash(out.password, salt);
    }
    const row = await prisma.user.create({ data: out });
    return toMongo(row);
  }

  async updateById(id, data) {
    const out = toPrismaData(data);
    if (out.password) {
      const salt = await bcrypt.genSalt(12);
      out.password = await bcrypt.hash(out.password, salt);
    }
    const row = await prisma.user.update({ where: { id }, data: out });
    return toMongo(row);
  }

  async updateOne(filter, data) {
    const existing = await prisma.user.findFirst({ where: toWhere(filter) });
    if (!existing) return null;
    const row = await prisma.user.update({ where: { id: existing.id }, data: toPrismaData(data) });
    return toMongo(row);
  }

  async findByEmail(email) {
    const row = await prisma.user.findFirst({ where: { email: email.toLowerCase() } });
    return toMongo(row);
  }

  async findByPhone(phone) {
    const row = await prisma.user.findFirst({ where: { phone } });
    return toMongo(row);
  }

  async addRefreshToken(userId, token) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { refreshTokens: true } });
    if (!user) return;
    await prisma.user.update({
      where: { id: userId },
      data: { refreshTokens: { set: [...user.refreshTokens, token] } },
    });
  }

  async removeRefreshToken(userId, token) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { refreshTokens: true } });
    if (!user) return;
    await prisma.user.update({
      where: { id: userId },
      data: { refreshTokens: { set: user.refreshTokens.filter((t) => t !== token) } },
    });
  }

  async clearAllRefreshTokens(userId) {
    await prisma.user.update({ where: { id: userId }, data: { refreshTokens: { set: [] } } });
  }

  // ─── Wishlist (Wishlist table) ─────────────────────────────────────────────

  async getWishlist(userId) {
    return prisma.wishlist.findUnique({ where: { userId } });
  }

  async getWishlistWithProducts(userId) {
    const wishlist = await prisma.wishlist.findUnique({ where: { userId } });
    if (!wishlist || !wishlist.items.length) return [];

    const productIds = wishlist.items.map((item) => item.productId).filter(Boolean);
    if (!productIds.length) return [];

    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        compareAtPrice: true,
        thumbnailUrl: true,
        thumbnailPublicId: true,
        stock: true,
        averageRating: true,
        ratingCount: true,
        brand: true,
        isActive: true,
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    return wishlist.items
      .filter((item) => productMap.has(item.productId))
      .map((item) => {
        const p = productMap.get(item.productId);
        return {
          productId: item.productId,
          addedAt: item.addedAt,
          product: {
            _id: p.id,
            id: p.id,
            name: p.name,
            slug: p.slug,
            price: p.price,
            compareAtPrice: p.compareAtPrice,
            thumbnail: p.thumbnailUrl ? { url: p.thumbnailUrl, publicId: p.thumbnailPublicId ?? null } : null,
            stock: p.stock,
            averageRating: p.averageRating,
            ratingCount: p.ratingCount,
            brand: p.brand,
            isActive: p.isActive,
            category: p.category ? { _id: p.category.id, id: p.category.id, name: p.category.name, slug: p.category.slug } : null,
          },
        };
      });
  }

  async addToWishlist(userId, productId) {
    const wishlist = await prisma.wishlist.findUnique({ where: { userId } });

    if (!wishlist) {
      return prisma.wishlist.create({
        data: {
          userId,
          items: [{ productId, addedAt: new Date().toISOString() }],
        },
      });
    }

    const alreadyExists = wishlist.items.some((item) => item.productId === productId);
    if (alreadyExists) return wishlist;

    return prisma.wishlist.update({
      where: { userId },
      data: {
        items: { set: [...wishlist.items, { productId, addedAt: new Date().toISOString() }] },
      },
    });
  }

  async removeFromWishlist(userId, productId) {
    const wishlist = await prisma.wishlist.findUnique({ where: { userId } });
    if (!wishlist) return null;

    return prisma.wishlist.update({
      where: { userId },
      data: {
        items: { set: wishlist.items.filter((item) => item.productId !== productId) },
      },
    });
  }

  async clearWishlist(userId) {
    const wishlist = await prisma.wishlist.findUnique({ where: { userId } });
    if (!wishlist) return null;

    return prisma.wishlist.update({
      where: { userId },
      data: { items: { set: [] } },
    });
  }

  async isInWishlist(userId, productId) {
    const wishlist = await prisma.wishlist.findUnique({ where: { userId } });
    if (!wishlist) return false;
    return wishlist.items.some((item) => item.productId === productId);
  }

  async updateLastLogin(userId) {
    await prisma.user.update({ where: { id: userId }, data: { lastLogin: new Date() } });
  }

  // Address management — Prisma stores addresses as Json[]
  async addAddress(userId, addressData) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { addresses: true } });
    if (!user) return null;
    if (addressData.isDefault) {
      addressData = { ...addressData };
      user.addresses = user.addresses.map((a) => ({ ...a, isDefault: false }));
    }
    const id = randomUUID();
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { addresses: { set: [...user.addresses, { ...addressData, id }] } },
    });
    return toMongo(updated);
  }

  async updateAddress(userId, addressId, addressData) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { addresses: true } });
    if (!user) return null;
    const addresses = user.addresses.map((a) =>
      (a.id === addressId || a._id === addressId) ? { ...a, ...addressData } : a
    );
    const updated = await prisma.user.update({ where: { id: userId }, data: { addresses: { set: addresses } } });
    return toMongo(updated);
  }

  async deleteAddress(userId, addressId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { addresses: true } });
    if (!user) return null;
    const addresses = user.addresses.filter((a) => a.id !== addressId && a._id !== addressId);
    const updated = await prisma.user.update({ where: { id: userId }, data: { addresses: { set: addresses } } });
    return toMongo(updated);
  }

  async setDefaultAddress(userId, addressId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { addresses: true } });
    if (!user) return null;
    const addresses = user.addresses.map((a) => ({
      ...a,
      isDefault: (a.id === addressId || a._id === addressId),
    }));
    const updated = await prisma.user.update({ where: { id: userId }, data: { addresses: { set: addresses } } });
    return toMongo(updated);
  }

  async incrementOtpAttempts(userId) {
    await prisma.user.update({ where: { id: userId }, data: { otpAttempts: { increment: 1 } } });
  }

  async searchUsers(search, filter = {}, skip = 0, limit = 20) {
    const where = toWhere(filter);
    return prisma.user.findMany({
      where: {
        ...where,
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }
}

module.exports = new UserRepository();
