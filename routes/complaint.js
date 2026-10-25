import express from "express";

import {
  protectRoutes,
  authorize,
} from "../middleware/auth.js";

import  validate  from "../middleware/validation.js";

import {
  createComplaintSchema,
  myComplaintsQuerySchema,
  schoolComplaintsQuerySchema,
  updateComplaintStatusSchema,
  complaintIdParamSchema,
} from "../validation/complaint.js";

import {
  createComplaint,
  getMyComplaints,
  getSchoolComplaints,
  updateComplaintStatus,
} from "../controllers/complaint.js";

const router = express.Router();

// ==========================================
// PERMISSIONS
// ==========================================

// Roles allowed to submit complaints.
// LEADER, VICE_LEADER, ADMINISTRATOR, EXAM_OFFICER,
// and STAFF represent staff-side accounts.
const complaintSubmitters = [
  "STUDENT",
  "PARENT",
  "STAFF",
  "LEADER",
  "VICE_LEADER",
  "ADMINISTRATOR",
  "EXAM_OFFICER",
];

// Only these roles can manage the school complaint inbox.
// The separate school owner is not included.
const complaintAdministrators = [
  "LEADER",
  "VICE_LEADER",
  "ADMINISTRATOR",
];

// ==========================================
// POST /api/complaints
// Submit a complaint
// ==========================================

router.post(
  "/",
  protectRoutes,
  authorize(...complaintSubmitters),
  validate(createComplaintSchema, "body"),
  createComplaint
);

// ==========================================
// GET /api/complaints/my
// Get the logged-in user's complaints
// ==========================================

router.get(
  "/my",
  protectRoutes,
  validate(myComplaintsQuerySchema, "query"),
  getMyComplaints
);

// ==========================================
// GET /api/complaints
// Get the school's complaint inbox
// ==========================================

router.get(
  "/",
  protectRoutes,
  authorize(...complaintAdministrators),
  validate(schoolComplaintsQuerySchema, "query"),
  getSchoolComplaints
);

// ==========================================
// PATCH /api/complaints/:complaintId/status
// Update complaint status
// ==========================================

router.patch(
  "/:complaintId/status",
  protectRoutes,
  authorize(...complaintAdministrators),
  validate(complaintIdParamSchema, "params"),
  validate(updateComplaintStatusSchema, "body"),
  updateComplaintStatus
);

export default router;