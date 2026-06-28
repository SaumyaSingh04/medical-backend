'use strict';

const { cartRepo } = require('../repositories');
const productRepo = require('../repositories/productRepo');
const { couponRepo } = require('../repositories');
const ApiError = require('../helpers/ApiError');
const { MESSAGES } = require('../constants');

class CartService {
  async getCart(userId) {
    let cart = await cartRepo.findByUser(userId);
    if (!cart) cart = await cartRepo.create({ user: userId, items: [] });
    return cart;
  }

  async addItem(userId, { productId, variantId, quantity }) {
    const product = await productRepo.findById(productId);
    if (!product || !product.isActive) throw ApiError.notFound(MESSAGES.PRODUCT_NOT_FOUND);

    let price = product.price;
    let compareAtPrice = product.compareAtPrice;
    let variantDetails = null;
    let stock = product.stock;

    if (variantId) {
      const variant = product.variants.id(variantId);
      if (!variant || !variant.isActive) throw ApiError.notFound('Variant not found.');
      price = variant.price;
      compareAtPrice = variant.compareAtPrice;
      stock = variant.stock;
      variantDetails = { name: variant.name, sku: variant.sku, color: variant.attributes?.color, size: variant.attributes?.size };
    }

    if (stock < quantity) throw ApiError.badRequest(MESSAGES.INSUFFICIENT_STOCK);

    // Check if item already exists in cart
    let cart = await cartRepo.findByUser(userId);
    if (!cart) cart = await cartRepo.create({ user: userId, items: [] });

    const existing = cart.items.find(
      (i) => (i.product?.id || i.product?._id) === productId && (!variantId || i.variant === variantId)
    );

    if (existing) {
      const newQty = existing.quantity + quantity;
      if (stock < newQty) throw ApiError.badRequest(MESSAGES.INSUFFICIENT_STOCK);
      // Update quantity via repo
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
        thumbnail: product.thumbnail?.url || product.images?.[0]?.url,
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
      const product = await productRepo.findById(item.product?.id || item.product?._id);
      if (!product || !product.isActive) throw ApiError.notFound(MESSAGES.PRODUCT_NOT_FOUND);
      const stock = item.variant
        ? product?.variants?.id(item.variant)?.stock
        : product?.stock;
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
    if (coupon.endDate < now || !coupon.isActive) throw ApiError.badRequest('Coupon is expired or exhausted.');
    if (coupon.usageLimit != null && coupon.totalUsed >= coupon.usageLimit) throw ApiError.badRequest('Coupon is expired or exhausted.');

    const cart = await cartRepo.findByUser(userId);
    if (!cart) throw ApiError.notFound('Cart not found.');

    const subtotal = cart.items.reduce((s, i) => s + i.price * i.quantity, 0);
    if (subtotal < (coupon.minOrderAmount || 0)) {
      throw ApiError.badRequest(`Minimum order amount of ₹${coupon.minOrderAmount} required.`);
    }

    let discount = 0;
    if (coupon.type === 'percentage') {
      discount = Math.min((subtotal * coupon.value) / 100, coupon.maxDiscount || Infinity);
    } else if (coupon.type === 'flat') {
      discount = Math.min(coupon.value, subtotal);
    }

    const roundedDiscount = Math.round(discount);
    await cartRepo.setCoupon(userId, coupon.code, roundedDiscount);
    return { cart: await cartRepo.findByUser(userId), discount: roundedDiscount };
  }
}

module.exports = new CartService();
