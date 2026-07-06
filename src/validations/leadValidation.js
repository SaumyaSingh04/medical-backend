'use strict';

const Joi = require('joi');

const STATUSES = ['new', 'contacted', 'follow_up', 'cnp', 'interested', 'not_interested', 'converted', 'lost'];
const SOURCES  = ['website', 'whatsapp', 'social_media', 'referral', 'manual', 'contact_form', 'franchise_form', 'distributor_form'];

const createLead = Joi.object({
  name:    Joi.string().trim().min(1).max(100).required(),
  phone:   Joi.string().trim().min(7).max(15).required(),
  email:   Joi.string().email().lowercase().allow('', null).optional(),
  problem: Joi.string().trim().max(500).allow('', null).optional(),
  address: Joi.string().trim().max(500).allow('', null).optional(),
  city:    Joi.string().trim().max(100).allow('', null).optional(),
  state:   Joi.string().trim().max(100).allow('', null).optional(),
  pincode: Joi.string().trim().max(10).allow('', null).optional(),
  source:  Joi.string().valid(...SOURCES).optional(),
  status:  Joi.string().valid(...STATUSES).optional(),
  assignedToId: Joi.string().uuid().allow(null).optional(),
  formData: Joi.object().unknown(true).allow(null).optional(),
});

const updateLead = Joi.object({
  name:    Joi.string().trim().min(1).max(100).optional(),
  phone:   Joi.string().trim().min(7).max(15).optional(),
  email:   Joi.string().email().lowercase().allow('', null).optional(),
  problem: Joi.string().trim().max(500).allow('', null).optional(),
  address: Joi.string().trim().max(500).allow('', null).optional(),
  city:    Joi.string().trim().max(100).allow('', null).optional(),
  state:   Joi.string().trim().max(100).allow('', null).optional(),
  pincode: Joi.string().trim().max(10).allow('', null).optional(),
  source:  Joi.string().valid(...SOURCES).optional(),
  status:  Joi.string().valid(...STATUSES).optional(),
  assignedToId: Joi.string().uuid().allow(null).optional(),
  orderId: Joi.string().uuid().allow(null).optional(),
});

const assignLead = Joi.object({
  assignedToId: Joi.string().uuid().required(),
});

const addNote = Joi.object({
  text:      Joi.string().trim().min(1).max(2000).required(),
  direction: Joi.string().valid('internal', 'inbound', 'outbound').optional(),
});

const addFollowUp = Joi.object({
  scheduledAt: Joi.date().iso().required(),
  note:        Joi.string().trim().max(1000).allow('', null).optional(),
});

const updateFollowUp = Joi.object({
  status:      Joi.string().valid('scheduled', 'completed', 'missed').optional(),
  completedAt: Joi.date().iso().allow(null).optional(),
  note:        Joi.string().trim().max(1000).allow('', null).optional(),
  scheduledAt: Joi.date().iso().optional(),
});

const listLeads = Joi.object({
  page:         Joi.number().integer().min(1).optional(),
  limit:        Joi.number().integer().min(1).max(100).optional(),
  status:       Joi.string().valid(...STATUSES).optional(),
  source:       Joi.string().valid(...SOURCES).optional(),
  assignedToId: Joi.string().uuid().optional(),
  createdById:  Joi.string().uuid().optional(),
  search:       Joi.string().trim().optional(),
  from:         Joi.string().isoDate().optional(),
  to:           Joi.string().isoDate().optional(),
  isDeleted:    Joi.boolean().optional(),
});

// Public form submissions (franchise / distributor)
const publicSubmit = Joi.object({
  name:    Joi.string().trim().min(1).max(100).required(),
  phone:   Joi.string().trim().min(7).max(15).required(),
  email:   Joi.string().email().lowercase().allow('', null).optional(),
  problem: Joi.string().trim().max(500).allow('', null).optional(),
  city:    Joi.string().trim().max(100).allow('', null).optional(),
  state:   Joi.string().trim().max(100).allow('', null).optional(),
  pincode: Joi.string().trim().max(10).allow('', null).optional(),
  address: Joi.string().trim().max(500).allow('', null).optional(),
}).unknown(true); // allow extra form fields stored in formData

module.exports = { createLead, updateLead, assignLead, addNote, addFollowUp, updateFollowUp, listLeads, publicSubmit };
