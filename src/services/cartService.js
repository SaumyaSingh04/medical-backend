'use strict';

const { cartRepo } = require('../repositories');
const productRepo = require('../repositories/productRepo');
const { couponRepo } = require('../repositories');
const ApiError = require('../helpers/ApiError');
const { MESSAGES } = require('../constants');

class CartService {
  async getCart(userId) {
    let cart = await cartRepo.findByUser(userId);
    if (!cart) cart = await cartRepo.create({ userId });
    return cart;
  }

  async addItem(userId, { productId, variantId, quantity }) {
    const product = await productRepo.findById(productId);
    if (!product || !product.isActive) throw ApiError.notFound(MESSAGES.PRODUCT_NOT_FOUND);

    let price = Number(product.price);
    let compareAtPrice = product.compareAtPrice != null ? Number(product.compareAtPrice) : null;
    let variantDetails = null;
    let stock = product.stock;

    if (variantId) {
      // variants is Json[] — use .find() not Mongoose .id()
      const variant = (product.variants || []).find((v) => v.id === variantId || v._id === variantId);
      if (!variant || variant.isActive === false) throw ApiError.notFound('Variant not found.');
      price = Number(variant.price);
      compareAtPrice = variant.compareAtPrice != null ? Number(variant.compareAtPrice) : null;
      stock = variant.stock ?? 0;
      // attributes may be flat on variant or nested under attributes{}
      variantDetails = {
        name: variant.name ?? null,
        sku: variant.sku ?? null,
        color: variant.color ?? variant.attributes?.color ?? null,
        size: variant.size ?? variant.attributes?.size ?? null,
      };
    }

    if (stock < quantity) throw ApiError.badRequest(MESSAGES.INSUFFICIENT_STOCK);

    let cart = await cartRepo.findByUser(userId);
    if (!cart) cart = await cartRepo.create({ userId });

    const existing = cart.items.find(
      (i) => i.product?.id === productId && (variantId ? i.variant === variantId : !i.variant)
    );

    if (existing) {
      const newQty = existing.quantity + quantity;
      if (stock < newQty) throw ApiError.badRequest(MESSAGES.INSUFFICIENT_STOCK);
      await cartRepo.updateItemQuantity(cart.id, existing.id, newQty);
    } else {
      await cartRepo.addItem(userId, {
        product: productId,
        variant: variantId || undefined,
        variantDetails,
        quantity,
        price,
        compareAtPrice,
        name: product.name,
        slug: product.slug,
        // productRepo.toMongo maps thumbnailUrl → thumbnail: { url, publicId }
        thumbnail: product.thumbnail?.url ?? product.thumbnailUrl ?? product.images?.[0]?.url ?? null,
      });
    }

    return cartRepo.findByUser(userId);
  }

  async updateItem(userId, itemId, quantity) {
    const cart = await cartRepo.findByUser(userId);
    if (!cart) throw ApiError.notFound('Cart not found.');

    const item = cart.items.find((i) => i.id === itemId);
    if (!item) throw ApiError.notFound('Cart item not found.');

    if (quantity <= 0) {
      await cartRepo.removeItem(cart.id, itemId);
    } else {
      const productId = item.product?.id ?? item.product?._id;
      const product = await productRepo.findById(productId);
      if (!product || !product.isActive) throw ApiError.notFound(MESSAGES.PRODUCT_NOT_FOUND);

      let stock;
      if (item.variant) {
        const variant = (product.variants || []).find((v) => v.id === item.variant || v._id === item.variant);
        stock = variant?.stock ?? 0;
      } else {
        stock = product.stock;
      }

      if (stock < quantity) throw ApiError.badRequest(MESSAGES.INSUFFICIENT_STOCK);
      await cartRepo.updateItemQuantity(cart.id, itemId, quantity);
    }

    return cartRepo.findByUser(userId);
  }

  async removeItem(userId, itemId) {
    const cart = await cartRepo.findByUser(userId);
    if (!cart) throw ApiError.notFound('Cart not found.');
    await cartRepo.removeItem(cart.id, itemId);
    return cartRepo.findByUser(userId);
  }

  async clearCart(userId) {
    return cartRepo.upsertCart(userId, { items: [], couponCode: null, couponDiscount: 0 });
  }

  async applyCoupon(userId, code) {
    const coupon = await couponRepo.findByCode(code);
    if (!coupon) throw ApiError.badRequest('Invalid coupon code.');

    const now = new Date();
    if (!coupon.isActive || coupon.endDate < now) throw ApiError.badRequest('Coupon is expired or exhausted.');
    if (coupon.usageLimit != null && coupon.totalUsed >= coupon.usageLimit)
      throw ApiError.badRequest('Coupon is expired or exhausted.');

    const cart = await cartRepo.findByUser(userId);
    if (!cart) throw ApiError.notFound('Cart not found.');

    const subtotal = cart.items.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
    const minOrder = Number(coupon.minOrderAmount ?? 0);
    if (subtotal < minOrder) {
      throw ApiError.badRequest(`Minimum order amount of ₹${minOrder} required.`);
    }

    let discount = 0;
    const value = Number(coupon.value);
    if (coupon.type === 'percentage') {
      const max = coupon.maxDiscount != null ? Number(coupon.maxDiscount) : Infinity;
      discount = Math.min((subtotal * value) / 100, max);
    } else if (coupon.type === 'flat') {
      discount = Math.min(value, subtotal);
    }

    const roundedDiscount = Math.round(discount);
    await cartRepo.setCoupon(userId, coupon.code, roundedDiscount);
    return { cart: await cartRepo.findByUser(userId), discount: roundedDiscount };
  }
}

module.exports = new CartService();
