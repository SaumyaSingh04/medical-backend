'use strict';

const ExcelJS = require('exceljs');

/**
 * Stream a CSV response directly to res.
 * @param {object} res       - Express response
 * @param {string} filename  - e.g. 'orders'
 * @param {string[]} headers - Column headers
 * @param {Array[]} rows     - Array of value arrays (same order as headers)
 */
const sendCSV = (res, filename, headers, rows) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}_${Date.now()}.csv"`);

  const escape = (v) => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n\r]/.test(s) ? `"${s}"` : s;
  };

  res.write(headers.map(escape).join(',') + '\r\n');
  for (const row of rows) {
    res.write(row.map(escape).join(',') + '\r\n');
  }
  res.end();
};

/**
 * Send an Excel (.xlsx) response.
 * @param {object} res
 * @param {string} filename
 * @param {string[]} headers
 * @param {Array[]} rows
 */
const sendExcel = async (res, filename, headers, rows) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Export');

  ws.columns = headers.map((h) => ({ header: h, key: h, width: Math.max(h.length + 4, 16) }));

  // Bold header row
  ws.getRow(1).font = { bold: true };

  for (const row of rows) {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
    ws.addRow(obj);
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}_${Date.now()}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
};

module.exports = { sendCSV, sendExcel };
