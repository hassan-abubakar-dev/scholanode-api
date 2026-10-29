import express from "express";

import {
  createContactInquiry,
  getContactInquiries,
  updateContactInquiryStatus,
  getContactInquiryStats,
} from "../controllers/platformContactInquiry.js";

import  validate  from "../middleware/validation.js";

import {
  createContactInquirySchema,
  getContactInquiriesQuerySchema,
  contactInquiryIdParamSchema,
  updateContactInquiryStatusSchema,
} from "../validation/platformContactInquiry.js";

const router = express.Router();


// ========================================
// Public routes
// ========================================

// Submit a public Contact ScholaNode inquiry
router.post(
  "/",
  validate(createContactInquirySchema, "body"),
  createContactInquiry
);


// ========================================
// Protected platform routes
// ========================================

// All routes below require platform-user authentication
// router.use(protectPlatformRoutes);


// Get inquiry statistics
router.get(
  "/stats",
  getContactInquiryStats
);


// Get inquiries with search, filters, sorting, and pagination
router.get(
  "/",
  validate(getContactInquiriesQuerySchema, "query"),
  getContactInquiries
);


// Update an inquiry's status
router.patch(
  "/:id/status",
  validate(contactInquiryIdParamSchema, "params"),
  validate(updateContactInquiryStatusSchema, "body"),
  updateContactInquiryStatus
);

export default router;