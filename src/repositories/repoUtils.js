'use strict';

function toOrderBy(sort) {
  if (!sort) return [{ createdAt: 'desc' }];
  if (typeof sort === 'string') {
    const field = sort.startsWith('-') ? sort.slice(1) : sort;
    return [{ [field]: sort.startsWith('-') ? 'desc' : 'asc' }];
  }
  return Object.entries(sort)
    .filter(([k]) => k !== 'score')
    .map(([k, v]) => ({ [k]: v === -1 || v === 'desc' ? 'desc' : 'asc' }));
}

// Plain objects — no need to allocate a new object on every call
const softDeleteData = { isDeleted: true,  deletedAt: new Date() };
const restoreData    = { isDeleted: false, deletedAt: null };
const withActive     = (where = {}) => ('isDeleted' in where ? where : { ...where, isDeleted: false });

module.exports = { toOrderBy, softDeleteData, restoreData, withActive };
