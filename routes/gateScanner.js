
import express from "express";

import { 
  verifyStudent, 
  recordStudentScan,
  authorizeStaffScanner,
  revokeStaffScanner,
  getAuthorizedScanners,
  getScanHistory,
  getSecurityDashboard
 } from "../controllers/gateScanner.js";
import { 
  verifyStudentSchema, 
  recordStudentScanSchema,
  authorizeStaffScannerSchema,
  revokeStaffScannerParamsSchema,
  getScanHistorySchema
} from "../validation/gateScanner.js";

import { protectRoutes } from "../middleware/auth.js";
import validate from "../middleware/validation.js";

const router = express.Router();

// Verify a student by QR token or admission number.
// Does not record a gate scan.
router.post(
  "/verify",
  protectRoutes,
  validate(verifyStudentSchema, "body"),
  verifyStudent
);


router.post(
  "/record",
  protectRoutes,
  validate(recordStudentScanSchema, "body"),
  recordStudentScan
);

// List scanner permissions for the school.
router.get(
  "/permissions",
  protectRoutes,
  getAuthorizedScanners
);

// Grant scanner permission to a staff member.
router.post(
  "/permissions",
  protectRoutes,
  validate(authorizeStaffScannerSchema, "body"),
  authorizeStaffScanner
);

// Revoke scanner permission without deleting its record.
router.patch(
  "/permissions/:userId/revoke",
  protectRoutes,
  validate(revokeStaffScannerParamsSchema, "params"),
  revokeStaffScanner
);

router.get(
  "/history",
  protectRoutes,
  validate(getScanHistorySchema, "query"),
  getScanHistory
);

router.get(
  "/dashboard",
  protectRoutes,
  getSecurityDashboard
);

export default router;
