'use strict';

const orderRepo = require('../repositories/orderRepo');
const productRepo = require('../repositories/productRepo');
const userRepo = require('../repositories/userRepo');
const cartService = require('./cartService');
const notificationService = require('./notificationService');
const { generateInvoicePDF } = require('../utils/pdfGenerator');
const ApiError = require('../helpers/ApiError');
const { parsePagination, buildPaginationMeta } = require('../helpers/paginate');
const { ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, MESSAGES, NOTIFICATION_TYPE, COD_SETTINGS } = require('../constants');
const { uploadBuffer } = require('../config/cloudinary');
const { paymentRepo } = require('../repositories');

class OrderService {
  async placeOrder(userId, { items, shippingAddressId, paymentMethod, couponCode, customerNote }) {
    // Validate items & compute pricing
    const orderItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = await productRepo.findById(item.productId);
      if (!product || !product.isActive) throw ApiError.notFound(MESSAGES.PRODUCT_NOT_FOUND);

      let price = product.price;
      let name = product.name;
      let variantDetails = null;

      if (item.variantId) {
        const variant = (product.variants || []).find(
          (v) => v.id === item.variantId || v._id === item.variantId
        );
        if (!variant) throw ApiError.badRequest('Variant not found.');
        price = variant.price;
        variantDetails = {
          name:  variant.name  ?? null,
          color: variant.color ?? variant.attributes?.color ?? null,
          size:  variant.size  ?? variant.attributes?.size  ?? null,
        };
      }

      const totalPrice = Number(price) * item.quantity;
      subtotal += totalPrice;
      orderItems.push({
        product: product.id,
        variant: item.variantId ?? null,
        name,
        slug: product.slug,
        thumbnail: product.thumbnailUrl ?? product.thumbnail?.url ?? null,
        sku: product.sku ?? null,
        variantDetails,
        quantity: item.quantity,
        price: Number(price),
        compareAtPrice: product.compareAtPrice != null ? Number(product.compareAtPrice) : null,
        totalPrice,
      });
    }

    // Shipping & tax (simplified)
    const shippingCharge = subtotal >= 499 ? 0 : 49;
    const taxAmount = 0;
    const couponDiscount = 0; // Applied via cart service
    const codConfirmationCharge = paymentMethod === PAYMENT_METHOD.COD ? COD_SETTINGS.CONFIRMATION_CHARGE : 0;
    const totalAmount = subtotal + shippingCharge + taxAmount - couponDiscount; // codConfirmationCharge is prepaid, not added to total

    // Get user's shipping address
    const user = await userRepo.findById(userId);
    if (!user) throw ApiError.notFound('User not found.');
    const address = (user.addresses || []).find(
      (a) => a._id?.toString() === shippingAddressId || a.id === shippingAddressId
    );
    if (!address) throw ApiError.badRequest('Shipping address not found.');

    const order = await orderRepo.create({
      user: userId,
      items: orderItems,
      subtotal,
      shippingCharge,
      taxAmount,
      couponCode,
      couponDiscount,
      codConfirmationCharge,
      totalAmount,
      shippingAddress: address,
      paymentMethod,
      status: ORDER_STATUS.PENDING,
      customerNote,
    });

    // Decrement stock
    for (const item of items) {
      await productRepo.decrementStock(item.productId, item.variantId, item.quantity).catch(() => {});
    }

    // Clear cart
    await cartService.clearCart(userId);

    // Notify user
    await notificationService.createNotification(userId, {
      type: NOTIFICATION_TYPE.ORDER_PLACED,
      title: 'Order Placed!',
      message: `Your order #${order.orderNumber} has been placed successfully.`,
      data: { orderId: order.id },
    });

    return order;
  }

  async getUserOrders(userId, queryParams) {
    const { page, limit, skip } = parsePagination(queryParams);
    const [orders, total] = await Promise.all([
      orderRepo.findUserOrders(userId, skip, limit),
      orderRepo.count({ user: userId }),
    ]);
    return { orders, meta: buildPaginationMeta(total, page, limit) };
  }

  async getOrderById(orderId, userId, role) {
    const order = await orderRepo.findWithPayment(orderId);
    if (!order) throw ApiError.notFound('Order not found.');
    if (role !== 'admin' && order.user !== userId) throw ApiError.forbidden();
    return order;
  }

  async cancelOrder(orderId, userId, reason) {
    const order = await orderRepo.findById(orderId);
    if (!order) throw ApiError.notFound('Order not found.');
    if (order.user !== userId) throw ApiError.forbidden();

    const cancellable = [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED];
    if (!cancellable.includes(order.status)) throw ApiError.badRequest(MESSAGES.ORDER_CANCEL_FORBIDDEN);

    // Re-stock
    for (const item of order.items) {
      await productRepo.incrementStock(item.product, item.variant, item.quantity);
    }

    const updated = await orderRepo.addStatusHistory(orderId, ORDER_STATUS.CANCELLED, reason, userId);

    await notificationService.createNotification(userId, {
      type: NOTIFICATION_TYPE.ORDER_CANCELLED,
      title: 'Order Cancelled',
      message: `Order #${order.orderNumber} has been cancelled.`,
      data: { orderId: order.id },
    });

    return updated;
  }

  async requestReturn(orderId, userId, reason) {
    const order = await orderRepo.findById(orderId);
    if (!order) throw ApiError.notFound('Order not found.');
    if (order.user !== userId) throw ApiError.forbidden();
    if (order.status !== ORDER_STATUS.DELIVERED) throw ApiError.badRequest('Only delivered orders can be returned.');

    return orderRepo.updateById(orderId, {
      status: ORDER_STATUS.RETURN_REQUESTED,
      returnReason: reason,
      returnRequestedAt: new Date(),
    }).then(() => orderRepo.addStatusHistory(orderId, ORDER_STATUS.RETURN_REQUESTED, reason, userId));
  }

  async updateOrderStatus(orderId, status, note, adminId) {
    const order = await orderRepo.findById(orderId);
    if (!order) throw ApiError.notFound('Order not found.');
    const updated = await orderRepo.addStatusHistory(orderId, status, note, adminId);

    await notificationService.createNotification(order.user.toString(), {
      type: NOTIFICATION_TYPE[`ORDER_${status.toUpperCase()}`] || NOTIFICATION_TYPE.SYSTEM,
      title: `Order ${status}`,
      message: `Your order #${order.orderNumber} status: ${status}.`,
      data: { orderId: order.id },
    });

    return updated;
  }

  async confirmCodOrder(orderId, userId) {
    const order = await orderRepo.findById(orderId);
    if (!order) throw ApiError.notFound('Order not found.');
    if (order.user !== userId) throw ApiError.forbidden();
    if (order.paymentMethod !== PAYMENT_METHOD.COD) throw ApiError.badRequest('Not a COD order.');
    if (order.paymentStatus === PAYMENT_STATUS.PAID) throw ApiError.badRequest('COD charge already confirmed.');

    // Create Payment record in DB for the ₹100 COD confirmation charge
    const payment = await paymentRepo.create({
      order: orderId,
      user: userId,
      provider: PAYMENT_METHOD.COD,
      amount: COD_SETTINGS.CONFIRMATION_CHARGE,
      currency: 'INR',
      status: PAYMENT_STATUS.CAPTURED,
      paidAt: new Date(),
    });

    // Link payment, confirm order status and payment status
    await orderRepo.updateById(orderId, {
      payment: payment.id,
      paymentStatus: PAYMENT_STATUS.PAID,
      status: ORDER_STATUS.CONFIRMED,
    });
    await orderRepo.addStatusHistory(orderId, ORDER_STATUS.CONFIRMED, `COD confirmation charge of ₹${COD_SETTINGS.CONFIRMATION_CHARGE} collected`, userId);

    await notificationService.createNotification(userId, {
      type: NOTIFICATION_TYPE.PAYMENT_SUCCESS,
      title: 'COD Confirmed',
      message: `COD confirmation charge of ₹${COD_SETTINGS.CONFIRMATION_CHARGE} collected for order #${order.orderNumber}.`,
      data: { orderId: order.id },
    });

    return { message: MESSAGES.COD_CHARGE_PAID, codConfirmationCharge: COD_SETTINGS.CONFIRMATION_CHARGE };
  }

  async generateInvoice(orderId) {
    const order = await orderRepo.findWithPayment(orderId);
    if (!order) throw ApiError.notFound('Order not found.');

    const pdfBuffer = await generateInvoicePDF(order);
    const uploaded = await uploadBuffer(pdfBuffer, 'invoices', {
      public_id: `invoice_${order.orderNumber}`,
      format: 'pdf',
      resource_type: 'raw',
    });

    await orderRepo.updateById(orderId, { invoiceUrl: uploaded.secure_url, invoiceNumber: order.orderNumber });
    return { invoiceUrl: uploaded.secure_url };
  }
}

module.exports = new OrderService();
