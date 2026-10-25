
import express from "express";

import { verifyStudent, recordStudentScan } from "../controllers/gateScanner.js";
import { verifyStudentSchema, recordStudentScanSchema } from "../validation/gateScanner.js";

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


export default router;
