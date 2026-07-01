'use strict';

const express = require('express');
const router = express.Router();
const { submitContact } = require('../controllers/contactController');
const { validate } = require('../middleware/validate');
const contactValidation = require('../validations/contactValidation');

/**
 * @swagger
 * /contact:
 *   post:
 *     tags: [Contact]
 *     summary: Submit a contact query
 *     description: Submits a contact/support query from a visitor or user.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, subject, message]
 *             properties:
 *               name: { type: string, minLength: 2, maxLength: 100, example: Saumya Singh }
 *               email: { type: string, format: email, example: saumya@example.com }
 *               phone: { type: string, pattern: '^[6-9]\d{9}$', example: '9876543210', description: Optional Indian phone number }
 *               subject: { type: string, minLength: 3, maxLength: 200, example: Issue with my order }
 *               message: { type: string, minLength: 10, maxLength: 2000, example: I placed an order but have not received any confirmation. }
 *     responses:
 *       201:
 *         description: Query submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Your query has been submitted successfully. }
 *                 data: { type: object }
 *                 timestamp: { type: string, format: date-time }
 *       400: { description: Validation error }
 */
router.post('/', validate(contactValidation.submitContact), submitContact);

module.exports = router;
