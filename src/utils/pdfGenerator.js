'use strict';

const PDFDocument = require('pdfkit');

/**
 * Generate an invoice PDF buffer for an order
 * @param {object} order - Populated order document
 * @returns {Promise<Buffer>}
 */
const generateInvoicePDF = (order) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // ── Header ──────────────────────────────────────────────
    doc.fontSize(20).font('Helvetica-Bold').text('TRIVEN', 50, 50);
    doc.fontSize(10).font('Helvetica').text('Premium Wellness Products', 50, 75);
    doc.text('www.medical-ecommerce.com | support@medical-ecommerce.com', 50, 88);

    doc.fontSize(22).font('Helvetica-Bold').text('INVOICE', 400, 50, { align: 'right' });
    doc.fontSize(10).font('Helvetica');
    doc.text(`Invoice #: ${order.orderNumber}`, 400, 80, { align: 'right' });
    doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`, 400, 94, { align: 'right' });

    // ── Divider ──────────────────────────────────────────────
    doc.moveTo(50, 120).lineTo(545, 120).stroke();

    // ── Billing & Shipping Address ────────────────────────────
    doc.fontSize(11).font('Helvetica-Bold').text('BILL TO:', 50, 135);
    doc.fontSize(10).font('Helvetica');
    const addr = order.shippingAddress;
    doc.text(addr.fullName, 50, 150);
    doc.text(`${addr.addressLine1}${addr.addressLine2 ? ', ' + addr.addressLine2 : ''}`, 50, 163);
    doc.text(`${addr.city}, ${addr.state} - ${addr.pincode}`, 50, 176);
    doc.text(`Phone: ${addr.phone}`, 50, 189);

    // ── Items Table Header ────────────────────────────────────
    const tableTop = 220;
    doc.moveTo(50, tableTop - 5).lineTo(545, tableTop - 5).stroke();
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Item', 50, tableTop);
    doc.text('Qty', 340, tableTop, { width: 50, align: 'right' });
    doc.text('Price', 400, tableTop, { width: 65, align: 'right' });
    doc.text('Total', 475, tableTop, { width: 70, align: 'right' });
    doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

    // ── Items ─────────────────────────────────────────────────
    let y = tableTop + 25;
    doc.font('Helvetica').fontSize(10);
    order.items.forEach((item) => {
      const name = item.variantDetails?.name ? `${item.name} (${item.variantDetails.name})` : item.name;
      doc.text(name, 50, y, { width: 280 });
      doc.text(item.quantity.toString(), 340, y, { width: 50, align: 'right' });
      doc.text(`₹${Number(item.price).toFixed(2)}`, 400, y, { width: 65, align: 'right' });
      doc.text(`₹${Number(item.totalPrice).toFixed(2)}`, 475, y, { width: 70, align: 'right' });
      y += 20;
    });

    // ── Totals ────────────────────────────────────────────────
    doc.moveTo(50, y + 5).lineTo(545, y + 5).stroke();
    y += 15;
    const totals = [
      ['Subtotal', order.subtotal],
      ['Shipping', order.shippingCharge],
      ['GST (18%)', order.taxAmount],
      ...(Number(order.couponDiscount) > 0 ? [['Coupon Discount', -Number(order.couponDiscount)]] : []),
    ];

    totals.forEach(([label, amount]) => {
      doc.font('Helvetica').text(label + ':', 380, y, { width: 100 });
      doc.text(`₹${Number(amount).toFixed(2)}`, 475, y, { width: 70, align: 'right' });
      y += 16;
    });

    doc.font('Helvetica-Bold').fontSize(12);
    doc.text('TOTAL:', 380, y, { width: 100 });
    doc.text(`₹${Number(order.totalAmount).toFixed(2)}`, 475, y, { width: 70, align: 'right' });

    // ── Footer ─────────────────────────────────────────────────
    doc.fontSize(9).font('Helvetica').text('Thank you for shopping with Medical E-Commerce!', 50, 720, { align: 'center' });
    doc.text('This is a computer-generated invoice and does not require a signature.', 50, 732, { align: 'center' });

    doc.end();
  });
};

module.exports = { generateInvoicePDF };
