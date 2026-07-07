'use strict';

const ExcelJS = require('exceljs');

// Sanitize filename to prevent Content-Disposition header injection.
const sanitizeFilename = (name) => name.replace(/[^\w\-]/g, '_');

// Shared: set download response headers.
const setDownloadHeaders = (res, contentType, filename, ext) => {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(filename)}_${Date.now()}.${ext}"`);
};

// CSV cell escaper — defined once at module scope, not per-call.
const escapeCSV = (v) => {
  if (v == null) return '';
  const s = String(v).replace(/"/g, '""');
  return /[",\n\r]/.test(s) ? `"${s}"` : s;
};

/**
 * Stream a CSV response directly to res.
 * @param {object}   res      - Express response
 * @param {string}   filename - e.g. 'orders'
 * @param {string[]} headers  - Column headers
 * @param {Array[]}  rows     - Array of value arrays (same order as headers)
 */
const sendCSV = (res, filename, headers, rows) => {
  setDownloadHeaders(res, 'text/csv', filename, 'csv');
  res.write(headers.map(escapeCSV).join(',') + '\r\n');
  for (const row of rows) res.write(row.map(escapeCSV).join(',') + '\r\n');
  res.end();
};

/**
 * Send an Excel (.xlsx) response.
 * @param {object}   res
 * @param {string}   filename
 * @param {string[]} headers
 * @param {Array[]}  rows
 */
const sendExcel = async (res, filename, headers, rows) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Export');

  ws.columns = headers.map((h) => ({ header: h, key: h, width: Math.max(h.length + 4, 16) }));
  ws.getRow(1).font = { bold: true };

  for (const row of rows) {
    const obj = Object.fromEntries(headers.map((h, i) => [h, row[i] ?? '']));
    ws.addRow(obj);
  }

  setDownloadHeaders(res, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename, 'xlsx');
  await wb.xlsx.write(res);
  res.end();
};

module.exports = { sendCSV, sendExcel };
