
import express from "express";

import {
  getTodayAttendance,
  createTodayAttendance,
  saveAttendanceDraft,
  submitAttendance,
   getAttendanceHistory,
  getMyAttendanceHistory,
  getAttendanceHistoryDetails
} from "../controllers/attendance.js";

import {
  registerIdSchema,
  saveAttendanceDraftSchema,
  submitAttendanceSchema,
  attendanceHistoryQuerySchema,
  myAttendanceHistoryQuerySchema
} from "../validation/attendance.js";

import validate from "../middleware/validation.js";
import {protectRoutes} from "../middleware/auth.js";

const router = express.Router();

// Fetch today's attendance without creating a register.
router.get(
  "/today",
  protectRoutes,
  getTodayAttendance
);

// Create today's register when the form master clicks Take Attendance.
router.post(
  "/create-today",
  protectRoutes,
  createTodayAttendance
);
// Save attendance progress without submitting the register.
router.patch(
  "/:registerId/draft",
  protectRoutes,
  validate(registerIdSchema, "params"),
  validate(saveAttendanceDraftSchema, "body"),
  saveAttendanceDraft
);

// Submit attendance register when the form master clicks Submit Attendance.
router.patch(
  "/:registerId/submit",
  protectRoutes,
  validate(registerIdSchema, "params"),
  validate(submitAttendanceSchema, "body"),
  submitAttendance
);

// Registers the authenticated form master's own class, for review and
// correction within the current session and term.
router.get(
  "/my-history",
  protectRoutes,
  validate(myAttendanceHistoryQuerySchema, "query"),
  getMyAttendanceHistory
);

router.get(
  "/history",
  protectRoutes,
  validate(attendanceHistoryQuerySchema, "query"),
  getAttendanceHistory
);

router.get(
  "/history/:registerId",
  protectRoutes,
  validate(registerIdSchema, "params"),
  getAttendanceHistoryDetails
);


export default router;
