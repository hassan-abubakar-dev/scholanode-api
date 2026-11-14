import express from "express";
import { getAllStaff, deactivateStaff, activateStaff, getLeaderStatus, updateStaff, resetStaffPassword, inviteStaff, importStaffCsv } from "../controllers/staff.js";
import {importStaffCsvSchema, inviteStaffValidationSchema, updateStaffSchema} from "../validation/staff.js";
import {
  authorize,
  authorizeSchoolManagement,
  protectRoutes,
} from "../middleware/auth.js";
import { uploadStaffCsv } from "../middleware/csvUpload.js";
import validate from "../middleware/validation.js";

const router = express.Router();

router.get(
  "/get-all",
  protectRoutes,
  authorizeSchoolManagement,
  getAllStaff
);

router.patch(
  "/:staffId/deactivate",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  deactivateStaff
);

router.patch(
  "/:staffId/activate",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  activateStaff
);

router.get(
  "/leader-status",
  protectRoutes,
  authorizeSchoolManagement,
  getLeaderStatus
);

router.patch(
  "/:staffId",
  protectRoutes,
  authorizeSchoolManagement,
  validate(updateStaffSchema, "body"),
  updateStaff
);

router.patch(
  "/:staffId/reset-password",
  protectRoutes,
  authorizeSchoolManagement,
  resetStaffPassword
);

router.post(
  "/invite",
  protectRoutes,
  authorizeSchoolManagement,
  validate(inviteStaffValidationSchema, "body"),
  inviteStaff
);


router.post(
  "/import-csv",
  protectRoutes,
  authorizeSchoolManagement,
  validate(importStaffCsvSchema, "body"),
  importStaffCsv
);


export default router;