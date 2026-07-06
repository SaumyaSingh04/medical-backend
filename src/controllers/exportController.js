'use strict';

const exportService          = require('../services/exportService');
const { sendCSV, sendExcel } = require('../utils/exportUtils');
const asyncHandler           = require('../utils/asyncHandler');

async function send(res, filename, { headers, rows }, format) {
  const fmt = (format || 'csv').toLowerCase() === 'xlsx' ? 'xlsx' : 'csv';
  if (fmt === 'xlsx') return sendExcel(res, filename, headers, rows);
  return sendCSV(res, filename, headers, rows);
}

const exportOrders = asyncHandler(async (req, res) => {
  const { from, to, status, format } = req.query;
  const data = await exportService.getOrderRows({ from, to, status });
  await send(res, 'orders', data, format);
});

const exportUsers = asyncHandler(async (req, res) => {
  const { role, from, to, format } = req.query;
  const data = await exportService.getUserRows({ role, from, to });
  await send(res, 'users', data, format);
});

const exportProducts = asyncHandler(async (req, res) => {
  const { categoryId, isActive, format } = req.query;
  const data = await exportService.getProductRows({ categoryId, isActive });
  await send(res, 'products', data, format);
});

const exportLeads = asyncHandler(async (req, res) => {
  const { status, source, from, to, format } = req.query;
  const data = await exportService.getLeadRows({ status, source, from, to });
  await send(res, 'leads', data, format);
});

module.exports = { exportOrders, exportUsers, exportProducts, exportLeads };
