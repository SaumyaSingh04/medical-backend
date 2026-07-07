'use strict';

const PDFDocument = require('pdfkit');

const fmt = (amount) => `₹${Number(amount).toFixed(2)}`;
const divider = (doc, y) => doc.moveTo(50, y).lineTo(545, y).stroke();

/**
 * Generate an invoice PDF buffer for an order.
 * @param {object} order - Populated order document
 * @returns {Promise<Buffer>}
 */
const generateInvoicePDF = (order) =>
  new Promise((resolve, reject) => {
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

    divider(doc, 120);

    // ── Billing Address ───────────────────────────────────────
    const addr = order.shippingAddress;
    doc.fontSize(11).font('Helvetica-Bold').text('BILL TO:', 50, 135);
    doc.fontSize(10).font('Helvetica');
    doc.text(addr.fullName, 50, 150);
    doc.text(`${addr.addressLine1}${addr.addressLine2 ? ', ' + addr.addressLine2 : ''}`, 50, 163);
    doc.text(`${addr.city}, ${addr.state} - ${addr.pincode}`, 50, 176);
    doc.text(`Phone: ${addr.phone}`, 50, 189);

    // ── Items Table Header ────────────────────────────────────
    const tableTop = 220;
    divider(doc, tableTop - 5);
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Item',  50,  tableTop);
    doc.text('Qty',  340,  tableTop, { width: 50,  align: 'right' });
    doc.text('Price', 400, tableTop, { width: 65,  align: 'right' });
    doc.text('Total', 475, tableTop, { width: 70,  align: 'right' });
    divider(doc, tableTop + 15);

    // ── Items ─────────────────────────────────────────────────
    let y = tableTop + 25;
    doc.font('Helvetica').fontSize(10);
    for (const item of order.items) {
      const name = item.variantDetails?.name ? `${item.name} (${item.variantDetails.name})` : item.name;
      doc.text(name,                          50,  y, { width: 280 });
      doc.text(String(item.quantity),        340,  y, { width: 50,  align: 'right' });
      doc.text(fmt(item.price),              400,  y, { width: 65,  align: 'right' });
      doc.text(fmt(item.totalPrice),         475,  y, { width: 70,  align: 'right' });
      y += 20;
    }

    // ── Totals ────────────────────────────────────────────────
    divider(doc, y + 5);
    y += 15;

    const totals = [
      ['Subtotal',    order.subtotal],
      ['Shipping',    order.shippingCharge],
      ['GST (18%)',   order.taxAmount],
      ...(Number(order.couponDiscount) > 0 ? [['Coupon Discount', -Number(order.couponDiscount)]] : []),
    ];

    doc.font('Helvetica').fontSize(10);
    for (const [label, amount] of totals) {
      doc.text(`${label}:`, 380, y, { width: 100 });
      doc.text(fmt(amount), 475, y, { width: 70, align: 'right' });
      y += 16;
    }

    doc.font('Helvetica-Bold').fontSize(12);
    doc.text('TOTAL:',        380, y, { width: 100 });
    doc.text(fmt(order.totalAmount), 475, y, { width: 70, align: 'right' });

    // ── Footer ─────────────────────────────────────────────────
    doc.fontSize(9).font('Helvetica')
      .text('Thank you for shopping with Medical E-Commerce!', 50, 720, { align: 'center' })
      .text('This is a computer-generated invoice and does not require a signature.', 50, 732, { align: 'center' });

    doc.end();
  });

module.exports = { generateInvoicePDF };
