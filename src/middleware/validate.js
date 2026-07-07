'use strict';

const ApiError = require('../helpers/ApiError');
const { MESSAGES } = require('../constants');

/**
 * Joi schema validation middleware factory.
 * @param {Joi.Schema} schema - Joi schema to validate against
 * @param {'body'|'query'|'params'} source - Request property to validate
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: source === 'body',
      convert: true,
    });

    if (error) {
      const errors = error.details.map((d) => ({
        field: d.path.join('.'),
        // Strip quotes but never expose internal schema details
        message: d.message.replace(/['"]([^'"]*)['"]/, '$1'),
      }));
      return next(ApiError.badRequest(MESSAGES.VALIDATION_ERROR, errors));
    }

    req[source] = value;
    next();
  };
};

module.exports = { validate };
