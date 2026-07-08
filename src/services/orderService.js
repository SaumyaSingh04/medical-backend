'use strict';

const orderRepo = require('../repositories/orderRepo');
const productRepo = require('../repositories/productRepo');
const userRepo = require('../repositories/userRepo');
const cartService = require('./cartService');
const notificationService = require('./notificationService');
const { generateInvoicePDF } = require('../utils/pdfGenerator');
const ApiError = require('../helpers/ApiError');
const { parsePagination, buildPaginationMeta } = require('../helpers/paginate');
const { ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, MESSAGES, NOTIFICATION_TYPE, COD_SETTINGS, ROLES } = require('../constants');
const { uploadBuffer } = require('../config/cloudinary');
const { paymentRepo } = require('../repositories');
const { addWhatsAppJob } = require('../jobs');
const { emitOrderStatusUpdate } = require('../sockets/orderSocket');
const { getIO } = require('../sockets');
const prisma = require('../repositories/prismaClient');

const FREE_SHIPPING_THRESHOLD = 499;
const SHIPPING_CHARGE = 49;

class OrderService {
  async placeOrder(userId, { items, shippingAddressId, paymentMethod, couponCode, customerNote }) {
    const productIds = items.map((item) => item.productId);
    const [productRows, user] = await Promise.all([
      productRepo.findManyByIds(productIds),
      userRepo.findById(userId),
    ]);

    if (!user) throw ApiError.notFound('User not found.');
    const address = (user.addresses || []).find(
      (a) => a._id?.toString() === shippingAddressId || a.id === shippingAddressId
    );
    if (!address) throw ApiError.badRequest('Shipping address not found.');

    const productMap = new Map(productRows.map((p) => [p.id, p]));
    const orderItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product || !product.isActive) throw ApiError.notFound(MESSAGES.PRODUCT_NOT_FOUND);

      let price = product.price;
      let variantDetails = null;
      let availableStock = product.stock;

      if (item.variantId) {
        const variant = (product.variants || []).find(
          (v) => v.id === item.variantId || v._id === item.variantId
        );
        if (!variant) throw ApiError.badRequest('Variant not found.');
        price = variant.price;
        availableStock = variant.stock ?? 0;
        variantDetails = {
          name:  variant.name  ?? null,
          color: variant.color ?? variant.attributes?.color ?? null,
          size:  variant.size  ?? variant.attributes?.size  ?? null,
        };
      }

      if (availableStock < item.quantity) {
        throw ApiError.badRequest(`Insufficient stock for "${product.name}". Available: ${availableStock}.`);
      }

      const totalPrice = Number(price) * item.quantity;
      subtotal += totalPrice;
      orderItems.push({
        product: product.id,
        variant: item.variantId ?? null,
        name: product.name,
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

    const shippingCharge = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_CHARGE;
    const taxAmount = 0;
    const couponDiscount = 0;
    const codConfirmationCharge = paymentMethod === PAYMENT_METHOD.COD ? COD_SETTINGS.CONFIRMATION_CHARGE : 0;
    const totalAmount = subtotal + shippingCharge + taxAmount - couponDiscount;

    // Wrap stock decrement + order creation in a transaction so a crash
    // between the two operations cannot leave stock decremented with no order.
    const order = await prisma.$transaction(async (tx) => {
      // Decrement stock for each item
      for (const item of items) {
        if (!item.variantId) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity }, totalSold: { increment: item.quantity } },
          });
        } else {
          const prod = await tx.product.findUnique({ where: { id: item.productId }, select: { variants: true } });
          if (prod) {
            const variants = prod.variants.map((v) =>
              (v._id === item.variantId || v.id === item.variantId)
                ? { ...v, stock: (v.stock || 0) - item.quantity }
                : v
            );
            await tx.product.update({
              where: { id: item.productId },
              data: { variants: { set: variants }, totalSold: { increment: item.quantity } },
            });
          }
        }
      }

      // Create the order
      return orderRepo.create({
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
    });

    await cartService.clearCart(userId);

    notificationService.createNotification(userId, {
      type: NOTIFICATION_TYPE.ORDER_PLACED,
      title: 'Order Placed!',
      message: `Your order #${order.orderNumber} has been placed successfully.`,
      data: { orderId: order.id },
    }).catch(() => {});

    if (user.phone) {
      addWhatsAppJob('sendOrderConfirmed', user.phone, [user.firstName || 'Customer', order.orderNumber, order.totalAmount]).catch(() => {});
    }

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
    const orderUserId = order.user?.id ?? order.user;
    if (role !== ROLES.ADMIN && /* role !== ROLES.SUPER_ADMIN && */ String(orderUserId) !== String(userId)) {
      throw ApiError.forbidden();
    }
    return order;
  }

  async cancelOrder(orderId, userId, reason) {
    const order = await orderRepo.findById(orderId);
    if (!order) throw ApiError.notFound('Order not found.');
    if (String(order.user) !== String(userId)) throw ApiError.forbidden();

    const cancellable = [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED];
    if (!cancellable.includes(order.status)) throw ApiError.badRequest(MESSAGES.ORDER_CANCEL_FORBIDDEN);

    await Promise.all(
      order.items
        .filter((item) => item.product)
        .map((item) => productRepo.incrementStock(item.product, item.variant, item.quantity))
    );

    const updated = await orderRepo.addStatusHistory(orderId, ORDER_STATUS.CANCELLED, reason, userId);

    notificationService.createNotification(userId, {
      type: NOTIFICATION_TYPE.ORDER_CANCELLED,
      title: 'Order Cancelled',
      message: `Order #${order.orderNumber} has been cancelled.`,
      data: { orderId: order.id },
    }).catch(() => {});

    return updated;
  }

  async requestReturn(orderId, userId, reason) {
    const order = await orderRepo.findById(orderId);
    if (!order) throw ApiError.notFound('Order not found.');
    if (String(order.user) !== String(userId)) throw ApiError.forbidden();
    if (order.status !== ORDER_STATUS.DELIVERED) throw ApiError.badRequest('Only delivered orders can be returned.');
    return orderRepo.addStatusHistory(orderId, ORDER_STATUS.RETURN_REQUESTED, reason, userId);
  }

  async updateOrderStatus(orderId, status, note, adminId) {
    const order = await orderRepo.findWithPayment(orderId);
    if (!order) throw ApiError.notFound('Order not found.');
    const updated = await orderRepo.addStatusHistory(orderId, status, note, adminId);

    const userId = order.user?.id ?? order.user?.toString();
    notificationService.createNotification(userId, {
      type: NOTIFICATION_TYPE[`ORDER_${status.toUpperCase()}`] || NOTIFICATION_TYPE.SYSTEM,
      title: `Order ${status}`,
      message: `Your order #${order.orderNumber} status: ${status}.`,
      data: { orderId: order.id },
    }).catch(() => {});

    try {
      const io = getIO();
      emitOrderStatusUpdate(io, orderId, status, { note });
    } catch { /* Socket.IO not initialized — non-fatal */ }

    const orderUser = order.user;
    if (orderUser?.phone) {
      const name = orderUser.firstName || 'Customer';
      if (status === ORDER_STATUS.SHIPPED) {
        addWhatsAppJob('sendOrderShipped', orderUser.phone, [name, order.orderNumber, note || '']).catch(() => {});
      } else if (status === ORDER_STATUS.DELIVERED) {
        addWhatsAppJob('sendOrderDelivered', orderUser.phone, [name, order.orderNumber]).catch(() => {});
      }
    }

    return updated;
  }

  async confirmCodOrder(orderId, userId) {
    const order = await orderRepo.findById(orderId);
    if (!order) throw ApiError.notFound('Order not found.');
    if (String(order.user) !== String(userId)) throw ApiError.forbidden();
    if (order.paymentMethod !== PAYMENT_METHOD.COD) throw ApiError.badRequest('Not a COD order.');
    if (order.paymentStatus === PAYMENT_STATUS.PAID) throw ApiError.badRequest('COD charge already confirmed.');

    const payment = await paymentRepo.create({
      order: orderId,
      user: userId,
      provider: PAYMENT_METHOD.COD,
      amount: COD_SETTINGS.CONFIRMATION_CHARGE,
      currency: 'INR',
      status: PAYMENT_STATUS.CAPTURED,
      paidAt: new Date(),
    });

    await orderRepo.updateById(orderId, {
      payment: payment.id,
      paymentStatus: PAYMENT_STATUS.PAID,
      status: ORDER_STATUS.CONFIRMED,
    });
    await orderRepo.addStatusHistory(
      orderId,
      ORDER_STATUS.CONFIRMED,
      `COD confirmation charge of ₹${COD_SETTINGS.CONFIRMATION_CHARGE} collected`,
      userId
    );

    notificationService.createNotification(userId, {
      type: NOTIFICATION_TYPE.PAYMENT_SUCCESS,
      title: 'COD Confirmed',
      message: `COD confirmation charge of ₹${COD_SETTINGS.CONFIRMATION_CHARGE} collected for order #${order.orderNumber}.`,
      data: { orderId: order.id },
    }).catch(() => {});

    return { message: MESSAGES.COD_CHARGE_PAID, codConfirmationCharge: COD_SETTINGS.CONFIRMATION_CHARGE };
  }

  async generateInvoice(orderId, userId, role) {
    const order = await orderRepo.findWithPayment(orderId);
    if (!order) throw ApiError.notFound('Order not found.');

    const orderUserId = order.user?.id ?? order.user;
    if (role !== ROLES.ADMIN && /* role !== ROLES.SUPER_ADMIN && */ String(orderUserId) !== String(userId)) {
      throw ApiError.forbidden();
    }

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
