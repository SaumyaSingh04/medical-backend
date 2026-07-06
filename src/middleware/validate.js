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
    // Respect schema-level unknown() preference; only strip at middleware level for body
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: source === 'body',
    });

    if (error) {
      const errors = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message.replace(/['"]/g, ''),
      }));
      return next(ApiError.badRequest(MESSAGES.VALIDATION_ERROR, errors));
    }

    // Replace req.body/query/params with validated, stripped value
    req[source] = value;
    next();
  };
};

module.exports = { validate };
