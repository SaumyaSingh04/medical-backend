'use strict';

const express = require('express');
const router  = express.Router();

const { authenticate } = require('../middleware/auth');
const { authorize }    = require('../middleware/authorize');
const { validate }     = require('../middleware/validate');
const v                = require('../validations/leadValidation');
const c                = require('../controllers/leadController');
const { auditLog }     = require('../middleware/auditLog');

const { ROLES } = require('../constants');

const isAdminOrSuperAdmin = authorize(ROLES.ADMIN);

// ─── Public (no auth) ─────────────────────────────────────────────────────────

/**
 * @swagger
 * /leads/public/website:
 *   post:
 *     tags: [Leads]
 *     summary: Submit a website enquiry lead
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, phone]
 *             properties:
 *               name: { type: string, example: Saumya Singh }
 *               phone: { type: string, example: '9876543210' }
 *               email: { type: string, format: email, example: saumya@example.com }
 *               message: { type: string, example: I am interested in your products }
 *     responses:
 *       201: { description: Lead submitted successfully }
 *       400: { description: Validation error }
 */
router.post('/public/website',     validate(v.publicSubmit), c.submitWebsiteLead);

/**
 * @swagger
 * /leads/public/franchise:
 *   post:
 *     tags: [Leads]
 *     summary: Submit a franchise enquiry lead
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, phone]
 *             properties:
 *               name: { type: string, example: Saumya Singh }
 *               phone: { type: string, example: '9876543210' }
 *               email: { type: string, format: email, example: saumya@example.com }
 *               message: { type: string, example: Interested in franchise opportunity }
 *     responses:
 *       201: { description: Lead submitted successfully }
 *       400: { description: Validation error }
 */
router.post('/public/franchise',   validate(v.publicSubmit), c.submitFranchiseLead);

/**
 * @swagger
 * /leads/public/distributor:
 *   post:
 *     tags: [Leads]
 *     summary: Submit a distributor enquiry lead
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, phone]
 *             properties:
 *               name: { type: string, example: Saumya Singh }
 *               phone: { type: string, example: '9876543210' }
 *               email: { type: string, format: email, example: saumya@example.com }
 *               message: { type: string, example: Interested in becoming a distributor }
 *     responses:
 *       201: { description: Lead submitted successfully }
 *       400: { description: Validation error }
 */
router.post('/public/distributor', validate(v.publicSubmit), c.submitDistributorLead);

// ─── All routes below require auth ───────────────────────────────────────────
router.use(authenticate);

/**
 * @swagger
 * /leads/stats:
 *   get:
 *     tags: [Leads]
 *     summary: Lead statistics (Admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lead stats by status and source
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     total: { type: integer, example: 320 }
 *                     byStatus: { type: object }
 *                     bySource: { type: object }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.get('/stats',  isAdminOrSuperAdmin, c.getLeadStats);

/**
 * @swagger
 * /leads/export:
 *   get:
 *     tags: [Leads]
 *     summary: Export leads as CSV (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: source
 *         schema: { type: string }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: CSV file download
 *         content:
 *           text/csv:
 *             schema: { type: string, format: binary }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.get('/export', isAdminOrSuperAdmin, validate(v.listLeads, 'query'), c.exportLeads);

/**
 * @swagger
 * /leads:
 *   get:
 *     tags: [Leads]
 *     summary: List all leads (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: source
 *         schema: { type: string, enum: [website, franchise, distributor, manual] }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Search by name, phone, or email
 *       - in: query
 *         name: assignedTo
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Paginated lead list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: array, items: { type: object } }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *   post:
 *     tags: [Leads]
 *     summary: Create a lead manually (Admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, phone]
 *             properties:
 *               name: { type: string, example: Saumya Singh }
 *               phone: { type: string, example: '9876543210' }
 *               email: { type: string, format: email }
 *               source: { type: string, enum: [website, franchise, distributor, manual], default: manual }
 *               status: { type: string, example: new }
 *               message: { type: string }
 *               assignedTo: { type: string, format: uuid }
 *     responses:
 *       201: { description: Lead created }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.route('/')
  .get(isAdminOrSuperAdmin, validate(v.listLeads, 'query'), c.getLeads)
  .post(isAdminOrSuperAdmin, validate(v.createLead), auditLog('create', 'Lead'), c.createLead);

/**
 * @swagger
 * /leads/{id}:
 *   get:
 *     tags: [Leads]
 *     summary: Get lead by ID (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Lead detail }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Lead not found }
 *   patch:
 *     tags: [Leads]
 *     summary: Update a lead (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               phone: { type: string }
 *               email: { type: string, format: email }
 *               status: { type: string }
 *               message: { type: string }
 *     responses:
 *       200: { description: Lead updated }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Lead not found }
 *   delete:
 *     tags: [Leads]
 *     summary: Delete a lead (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Lead deleted }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Lead not found }
 */
router.route('/:id')
  .get(isAdminOrSuperAdmin, c.getLead)
  .patch(isAdminOrSuperAdmin, validate(v.updateLead), auditLog('update', 'Lead'), c.updateLead)
  .delete(isAdminOrSuperAdmin, auditLog('delete', 'Lead'), c.deleteLead);

/**
 * @swagger
 * /leads/{id}/assign:
 *   patch:
 *     tags: [Leads]
 *     summary: Assign lead to a user (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [assignedTo]
 *             properties:
 *               assignedTo: { type: string, format: uuid, description: User UUID to assign the lead to }
 *     responses:
 *       200: { description: Lead assigned }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Lead not found }
 */
router.patch('/:id/assign', isAdminOrSuperAdmin, validate(v.assignLead), auditLog('assign', 'Lead'), c.assignLead);

/**
 * @swagger
 * /leads/{id}/cnp:
 *   patch:
 *     tags: [Leads]
 *     summary: Mark lead as CNP (Could Not Proceed) (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Lead marked as CNP }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Lead not found }
 */
router.patch('/:id/cnp',   isAdminOrSuperAdmin, auditLog('cnp',   'Lead'), c.markCNP);

/**
 * @swagger
 * /leads/{id}/uncnp:
 *   patch:
 *     tags: [Leads]
 *     summary: Unmark lead CNP status (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Lead CNP status removed }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Lead not found }
 */
router.patch('/:id/uncnp', isAdminOrSuperAdmin, auditLog('uncnp', 'Lead'), c.unmarkCNP);

/**
 * @swagger
 * /leads/{id}/notes:
 *   get:
 *     tags: [Leads]
 *     summary: Get notes for a lead (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: List of notes }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Lead not found }
 *   post:
 *     tags: [Leads]
 *     summary: Add a note to a lead (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [note]
 *             properties:
 *               note: { type: string, example: Called customer, interested in bulk order }
 *     responses:
 *       201: { description: Note added }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Lead not found }
 */
router.route('/:id/notes')
  .get(isAdminOrSuperAdmin, c.getNotes)
  .post(isAdminOrSuperAdmin, validate(v.addNote), c.addNote);

/**
 * @swagger
 * /leads/{id}/notes/{noteId}:
 *   delete:
 *     tags: [Leads]
 *     summary: Delete a note from a lead (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: noteId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Note deleted }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Note not found }
 */
router.delete('/:id/notes/:noteId', isAdminOrSuperAdmin, c.deleteNote);

/**
 * @swagger
 * /leads/{id}/follow-ups:
 *   get:
 *     tags: [Leads]
 *     summary: Get follow-ups for a lead (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: List of follow-ups }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Lead not found }
 *   post:
 *     tags: [Leads]
 *     summary: Add a follow-up to a lead (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [scheduledAt]
 *             properties:
 *               scheduledAt: { type: string, format: date-time, example: '2025-02-01T10:00:00.000Z' }
 *               note: { type: string, example: Follow up regarding bulk order }
 *     responses:
 *       201: { description: Follow-up added }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Lead not found }
 */
router.route('/:id/follow-ups')
  .get(isAdminOrSuperAdmin, c.getFollowUps)
  .post(isAdminOrSuperAdmin, validate(v.addFollowUp), c.addFollowUp);

/**
 * @swagger
 * /leads/{id}/follow-ups/{followUpId}:
 *   patch:
 *     tags: [Leads]
 *     summary: Update a follow-up (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: followUpId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scheduledAt: { type: string, format: date-time }
 *               note: { type: string }
 *               isDone: { type: boolean }
 *     responses:
 *       200: { description: Follow-up updated }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Follow-up not found }
 *   delete:
 *     tags: [Leads]
 *     summary: Delete a follow-up (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: followUpId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Follow-up deleted }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Follow-up not found }
 */
router.patch('/:id/follow-ups/:followUpId', isAdminOrSuperAdmin, validate(v.updateFollowUp), c.updateFollowUp);
router.delete('/:id/follow-ups/:followUpId', isAdminOrSuperAdmin, c.deleteFollowUp);

/**
 * @swagger
 * /leads/{id}/restore:
 *   patch:
 *     tags: [Leads]
 *     summary: Restore a soft-deleted lead (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Lead restored }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Lead not found }
 */
router.patch('/:id/restore', isAdminOrSuperAdmin, auditLog('restore', 'Lead'), c.restoreLead);

/**
 * @swagger
 * /leads/{id}/timeline:
 *   get:
 *     tags: [Leads]
 *     summary: Get lead activity timeline (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Lead timeline events
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: array, items: { type: object } }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Lead not found }
 */
router.get('/:id/timeline', isAdminOrSuperAdmin, c.getTimeline);

module.exports = router;
