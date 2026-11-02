import express from "express";
import { getAllStaff, deactivateStaff, activateStaff, getLeaderStatus, updateStaff, resetStaffPassword, inviteStaff, importStaffCsv } from "../controllers/staff.js";
import {importStaffCsvSchema, inviteStaffValidationSchema, updateStaffSchema} from "../validation/staff.js";
import { authorize, protectRoutes } from "../middleware/auth.js";
import { uploadStaffCsv } from "../middleware/csvUpload.js";
import validate from "../middleware/validation.js";

const router = express.Router();

router.get(
  "/get-all",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
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
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  getLeaderStatus
);

router.patch(
  "/:staffId",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  validate(updateStaffSchema, "body"),
  updateStaff
);

router.patch(
  "/:staffId/reset-password",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  resetStaffPassword
);

router.post(
  "/invite",
  protectRoutes,
  validate(inviteStaffValidationSchema, "body"),
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  inviteStaff
);


router.post(
  "/import-csv",
  protectRoutes,
  validate(importStaffCsvSchema, "body"),
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  importStaffCsv
);


export default router;