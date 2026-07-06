'use strict';

const ApiError = require('../helpers/ApiError');

/**
 * Resolves a flexible date range query into { start, end, label }.
 *
 * Supported range values:
 *   today       — midnight → now (local server day)
 *   yesterday   — full previous calendar day
 *   thisWeek    — Monday of current week → now
 *   thisMonth   — 1st of current month → now
 *   lastMonth   — full previous calendar month
 *   allTime     — no date filter (start/end both null)
 *   custom      — requires from + to as YYYY-MM-DD strings
 *
 * Returns { start: Date|null, end: Date|null, label: string }
 * start/end are null only for allTime — callers must handle that case
 * by omitting the createdAt filter entirely.
 */
function resolveDateRange(range = 'thisMonth', from, to) {
  const now   = new Date();
  const y     = now.getFullYear();
  const m     = now.getMonth();
  const d     = now.getDate();

  switch (range) {
    case 'today': {
      const start = new Date(y, m, d, 0, 0, 0, 0);
      return { start, end: now, label: 'today' };
    }

    case 'yesterday': {
      const start = new Date(y, m, d - 1, 0, 0, 0, 0);
      const end   = new Date(y, m, d,     0, 0, 0, 0);  // midnight = start of today
      return { start, end, label: 'yesterday' };
    }

    case 'thisWeek': {
      // ISO week: Monday = day 1
      const day   = now.getDay() || 7;                   // Sunday → 7
      const start = new Date(y, m, d - (day - 1), 0, 0, 0, 0);
      return { start, end: now, label: 'thisWeek' };
    }

    case 'thisMonth': {
      const start = new Date(y, m, 1, 0, 0, 0, 0);
      return { start, end: now, label: 'thisMonth' };
    }

    case 'lastMonth': {
      const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
      const end   = new Date(y, m,     1, 0, 0, 0, 0);  // midnight = start of this month
      return { start, end, label: 'lastMonth' };
    }

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
