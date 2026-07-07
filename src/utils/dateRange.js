'use strict';

const ApiError = require('../helpers/ApiError');

/**
 * Resolves a flexible date range query into { start, end, label }.
 *
 * Supported range values:
 *   today, yesterday, thisWeek, thisMonth, lastMonth, allTime, custom
 *
 * Returns { start: Date|null, end: Date|null, label: string }
 * start/end are null only for allTime.
 */
function resolveDateRange(range = 'thisMonth', from, to) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  const midnight = (yr, mo, dy) => new Date(yr, mo, dy, 0, 0, 0, 0);

  switch (range) {
    case 'today':
      return { start: midnight(y, m, d), end: now, label: 'today' };

    case 'yesterday':
      return { start: midnight(y, m, d - 1), end: midnight(y, m, d), label: 'yesterday' };

    case 'thisWeek': {
      const day = now.getDay() || 7; // Sunday → 7
      return { start: midnight(y, m, d - (day - 1)), end: now, label: 'thisWeek' };
    }

    case 'thisMonth':
      return { start: midnight(y, m, 1), end: now, label: 'thisMonth' };

    case 'lastMonth':
      return { start: midnight(y, m - 1, 1), end: midnight(y, m, 1), label: 'lastMonth' };

    case 'allTime':
      return { start: null, end: null, label: 'allTime' };

    case 'custom': {
      if (!from || !to) throw ApiError.badRequest('custom range requires from and to (YYYY-MM-DD).');
      const start = new Date(`${from}T00:00:00.000`);
      const end   = new Date(`${to}T23:59:59.999`);
      if (isNaN(start) || isNaN(end)) throw ApiError.badRequest('Invalid from/to date format. Use YYYY-MM-DD.');
      if (start > end) throw ApiError.badRequest('from must be before or equal to to.');
      return { start, end, label: `${from} → ${to}` };
    }

    default:
      throw ApiError.badRequest(`Invalid range "${range}". Valid values: today, yesterday, thisWeek, thisMonth, lastMonth, allTime, custom.`);
  }
}

module.exports = { resolveDateRange };
