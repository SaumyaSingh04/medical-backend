'use strict';

/** Merge caller's where with isDeleted: false (unless caller already sets isDeleted) */
const withActive = (where = {}) => {
  if ('isDeleted' in where) return where;
  return { ...where, isDeleted: false };
};

/** Data payload to soft-delete a record */
const softDeleteData = () => ({ isDeleted: true, deletedAt: new Date() });

/** Data payload to restore a soft-deleted record */
const restoreData = () => ({ isDeleted: false, deletedAt: null });

module.exports = { withActive, softDeleteData, restoreData };
