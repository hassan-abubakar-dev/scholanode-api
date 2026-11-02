import express from "express";

import {
  createSchoolInquiry,
  getSchoolInquiries,
  updateSchoolInquiryStatus,
} from "../controllers/schoolInquiry.js";

import { authorize, protectRoutes } from "../middleware/auth.js";
import validate from "../middleware/validation.js";

import {
  createSchoolInquirySchema,
  getSchoolInquiriesQuerySchema,
  schoolInquiryIdParamSchema,
  updateSchoolInquiryStatusSchema,
} from "../validation/schoolInquiry.js";

const router = express.Router();


// Submit an inquiry (public)
router.post(
  "/",
  validate(createSchoolInquirySchema, "body"),
  createSchoolInquiry
);


// Get inquiries for the authenticated user's school
router.get(
  "/",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  validate(getSchoolInquiriesQuerySchema, "query"),
  getSchoolInquiries
);


// Update an inquiry's status
router.patch(
  "/:id/status",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  validate(schoolInquiryIdParamSchema, "params"),
  validate(updateSchoolInquiryStatusSchema, "body"),
  updateSchoolInquiryStatus
);

export default router;