'use strict';

const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const prisma = require('./prismaClient');
const { toOrderBy } = require('./repoUtils');

const BCRYPT_ROUNDS = 12;

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
              passwordResetExpiry, loginAttempts, lockUntil, googleId, ...pub } = this;
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
    out.avatarUrl      = avatar?.url ?? null;
    out.avatarPublicId = avatar?.publicId ?? null;
  }
  return out;
}

function toWhere(filter = {}) {
  const where = {};
  for (const [k, v] of Object.entries(filter)) {
    where[k === '_id' || k === 'id' ? 'id' : k] = v;
  }
  return where;
}

function buildSearchOR(search) {
  return [
    { firstName: { contains: search, mode: 'insensitive' } },
    { lastName:  { contains: search, mode: 'insensitive' } },
    { email:     { contains: search, mode: 'insensitive' } },
  ];
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, await bcrypt.genSalt(BCRYPT_ROUNDS));
}

// Shared helper: fetch user addresses, apply transform fn, persist and return shaped user.
async function mutateAddresses(userId, transformFn) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { addresses: true } });
  if (!user) return null;
  const addresses = transformFn(user.addresses);
  const updated = await prisma.user.update({ where: { id: userId }, data: { addresses: { set: addresses } } });
  return toMongo(updated);
}

class UserRepository {
  async findById(id) {
    return toMongo(await prisma.user.findUnique({ where: { id } }));
  }

  async findOne(filter) {
    return toMongo(await prisma.user.findFirst({ where: toWhere(filter) }));
  }

  async findAll(filter = {}, options = {}) {
    const { sort = { createdAt: -1 }, skip = 0, limit = 20 } = options;
    const rows = await prisma.user.findMany({ where: toWhere(filter), orderBy: toOrderBy(sort), skip, take: limit });
    return rows.map(toMongo);
  }

  async count(filter = {}) {
    return prisma.user.count({ where: toWhere(filter) });
  }

  async create(data) {
    const out = toPrismaData(data);
    if (out.email)    out.email    = out.email.toLowerCase();
    if (out.password) out.password = await hashPassword(out.password);
    return toMongo(await prisma.user.create({ data: out }));
  }

  async updateById(id, data) {
    const out = toPrismaData(data);
    if (out.password) out.password = await hashPassword(out.password);
    return toMongo(await prisma.user.update({ where: { id }, data: out }));
  }

  async updateOne(filter, data) {
    const existing = await prisma.user.findFirst({ where: toWhere(filter), select: { id: true } });
    if (!existing) return null;
    return toMongo(await prisma.user.update({ where: { id: existing.id }, data: toPrismaData(data) }));
  }

  async findByEmail(email) {
    return toMongo(await prisma.user.findUnique({ where: { email: email.toLowerCase() } }));
  }

  async findByPhone(phone) {
    return toMongo(await prisma.user.findFirst({ where: { phone } }));
  }

  async addRefreshToken(userId, token) {
    await prisma.user.update({ where: { id: userId }, data: { refreshTokens: { push: token } } });
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

  // ─── Wishlist ──────────────────────────────────────────────────────────────

  async getWishlist(userId) {
    return prisma.wishlist.findUnique({ where: { userId } });
  }

  async getWishlistWithProducts(userId) {
    const wishlist = await prisma.wishlist.findUnique({ where: { userId } });
    if (!wishlist?.items?.length) return [];

    const productIds = wishlist.items.map((item) => item.productId).filter(Boolean);
    if (!productIds.length) return [];

    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: {
        id: true, name: true, slug: true, price: true, compareAtPrice: true,
        thumbnailUrl: true, thumbnailPublicId: true, stock: true,
        averageRating: true, ratingCount: true, brand: true, isActive: true,
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
          addedAt:   item.addedAt,
          product: {
            _id: p.id, id: p.id, name: p.name, slug: p.slug,
            price: p.price, compareAtPrice: p.compareAtPrice,
            thumbnail: p.thumbnailUrl ? { url: p.thumbnailUrl, publicId: p.thumbnailPublicId ?? null } : null,
            stock: p.stock, averageRating: p.averageRating, ratingCount: p.ratingCount,
            brand: p.brand, isActive: p.isActive,
            category: p.category
              ? { _id: p.category.id, id: p.category.id, name: p.category.name, slug: p.category.slug }
              : null,
          },
        };
      });
  }

  async addToWishlist(userId, productId) {
    const wishlist = await prisma.wishlist.upsert({
      where:  { userId },
      create: { userId, items: [] },
      update: {},
    });

    const pid = String(productId);
    if (wishlist.items.some((item) => String(item.productId) === pid)) return wishlist;

    // Append new item — no need to re-map existing items since they're already stored correctly
    return prisma.wishlist.update({
      where: { userId },
      data:  { items: { set: [...wishlist.items, { productId: pid, addedAt: new Date().toISOString() }] } },
    });
  }

  async updateWishlistItems(userId, items) {
    return prisma.wishlist.upsert({
      where:  { userId },
      update: { items: { set: items } },
      create: { userId, items },
    });
  }

  async removeFromWishlist(userId, productId) {
    const wishlist = await prisma.wishlist.findUnique({ where: { userId } });
    if (!wishlist) return null;
    const filtered = wishlist.items.filter((item) => String(item.productId) !== String(productId));
    return prisma.wishlist.update({ where: { userId }, data: { items: { set: filtered } } });
  }

  async clearWishlist(userId) {
    return prisma.wishlist.upsert({
      where:  { userId },
      update: { items: { set: [] } },
      create: { userId, items: [] },
    });
  }

  async isInWishlist(userId, productId) {
    const wishlist = await prisma.wishlist.findUnique({ where: { userId }, select: { items: true } });
    return wishlist?.items.some((item) => String(item.productId) === String(productId)) ?? false;
  }

  async updateLastLogin(userId) {
    await prisma.user.update({ where: { id: userId }, data: { lastLogin: new Date() } });
  }

  // ─── Addresses ─────────────────────────────────────────────────────────────

  async addAddress(userId, addressData) {
    return mutateAddresses(userId, (addresses) => {
      const base = addressData.isDefault ? addresses.map((a) => ({ ...a, isDefault: false })) : addresses;
      return [...base, { ...addressData, id: randomUUID() }];
    });
  }

  async updateAddress(userId, addressId, addressData) {
    return mutateAddresses(userId, (addresses) =>
      addresses.map((a) => (a.id === addressId || a._id === addressId ? { ...a, ...addressData } : a))
    );
  }

  async deleteAddress(userId, addressId) {
    return mutateAddresses(userId, (addresses) =>
      addresses.filter((a) => a.id !== addressId && a._id !== addressId)
    );
  }

  async setDefaultAddress(userId, addressId) {
    return mutateAddresses(userId, (addresses) =>
      addresses.map((a) => ({ ...a, isDefault: a.id === addressId || a._id === addressId }))
    );
  }

  async incrementOtpAttempts(userId) {
    await prisma.user.update({ where: { id: userId }, data: { otpAttempts: { increment: 1 } } });
  }

  async searchUsers(search, filter = {}, skip = 0, limit = 20) {
    return prisma.user.findMany({
      where: { ...toWhere(filter), OR: buildSearchOR(search) },
      skip, take: limit, orderBy: { createdAt: 'desc' },
    });
  }

  async countSearch(search, filter = {}) {
    return prisma.user.count({ where: { ...toWhere(filter), OR: buildSearchOR(search) } });
  }
}

module.exports = new UserRepository();
