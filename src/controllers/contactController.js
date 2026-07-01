'use strict';

const contactService = require('../services/contactService');
const { sendSuccess, sendPaginated } = require('../helpers/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

const submitContact = asyncHandler(async (req, res) => {
  const { name, email, phone, subject, message } = req.body;
  const contact = await contactService.submitContact({ name, email, phone, subject, message });
  sendSuccess(res, 'Your query has been submitted successfully.', contact, 201);
});

const listContacts = asyncHandler(async (req, res) => {
  const { data, meta } = await contactService.listContacts(req.query);
  sendPaginated(res, 'Fetched successfully.', data, meta);
});

const updateContactStatus = asyncHandler(async (req, res) => {
  const contact = await contactService.updateContactStatus(req.params.id, req.body.status, req.body.adminNote);
  sendSuccess(res, 'Contact status updated.', contact);
});

module.exports = { submitContact, listContacts, updateContactStatus };
