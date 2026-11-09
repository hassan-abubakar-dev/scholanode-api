import express from "express";

import { protectRoutes } from "../middleware/auth.js";
import validate from "../middleware/validation.js";
import AppError from "../utils/AppError.js";

import {
  getTimetable,
  getSchoolWorkingDays,
  generateTimetablePdf,
  searchClassesForTimetable,
  createPeriod,
  updatePeriod,
  deletePeriod,
  createLesson,
  updateLesson,
  deleteLesson,
} from "../controllers/timetable.js";

import {
  timetableQuerySchema,
  adminTimetableSearchSchema,
  periodParamsSchema,
  lessonParamsSchema,
  createPeriodSchema,
  updatePeriodSchema,
  createLessonSchema,
  updateLessonSchema,
} from "../validation/timetable.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Authorization Middleware
|--------------------------------------------------------------------------
*/

const allowRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user?.role)) {
      return next(
        new AppError(
          "You are not authorized to perform this action.",
          403
        )
      );
    }

    next();
  };
};

const PERIOD_MANAGEMENT_ROLES = [
  "LEADER",
  "VICE_LEADER",
  "ADMINISTRATOR",
];

const ADMIN_VIEW_ROLES = [
  "LEADER",
  "VICE_LEADER",
  "ADMINISTRATOR",
  "EXAM_OFFICER",
];

/*
|--------------------------------------------------------------------------
| Timetable Viewing
|--------------------------------------------------------------------------
*/

// GET /api/timetable?classId=<classId>
//
// Access is checked inside the controller based on the requested class.

router.get(
  "/",
  protectRoutes,
  validate(timetableQuerySchema, "query"),
  getTimetable
);

/*
|--------------------------------------------------------------------------
| Administrative Timetable Search
|--------------------------------------------------------------------------
*/

// GET /api/timetable/admin/classes
//
// Includes classes without Form Masters and classes without lessons.

router.get(
  "/admin/classes",
  protectRoutes,
  allowRoles(...ADMIN_VIEW_ROLES),
  validate(adminTimetableSearchSchema, "query"),
  searchClassesForTimetable
);

/*
|--------------------------------------------------------------------------
| Working Days and PDF
|--------------------------------------------------------------------------
*/

// GET /api/timetable/working-days

router.get(
  "/working-days",
  protectRoutes,
  getSchoolWorkingDays
);

// GET /api/timetable/pdf?classId=<classId>&download=true

router.get(
  "/pdf",
  protectRoutes,
  validate(timetableQuerySchema, "query"),
  generateTimetablePdf
);

/*
|--------------------------------------------------------------------------
| School-Wide Timetable Periods
|--------------------------------------------------------------------------
*/

// POST /api/timetable/periods

router.post(
  "/periods",
  protectRoutes,
  allowRoles(...PERIOD_MANAGEMENT_ROLES),
  validate(createPeriodSchema, "body"),
  createPeriod
);

// PATCH /api/timetable/periods/:periodId

router.patch(
  "/periods/:periodId",
  protectRoutes,
  allowRoles(...PERIOD_MANAGEMENT_ROLES),
  validate(periodParamsSchema, "params"),
  validate(updatePeriodSchema, "body"),
  updatePeriod
);

// DELETE /api/timetable/periods/:periodId

router.delete(
  "/periods/:periodId",
  protectRoutes,
  allowRoles(...PERIOD_MANAGEMENT_ROLES),
  validate(periodParamsSchema, "params"),
  deletePeriod
);

/*
|--------------------------------------------------------------------------
| Form Master Class Timetable Lessons
|--------------------------------------------------------------------------
*/

// Only STAFF can reach these routes.
// The controller verifies active status, assigned class, and the
// one-class Form Master rule before allowing any modification.

// POST /api/timetable/lessons

router.post(
  "/lessons",
  protectRoutes,
  allowRoles("STAFF"),
  validate(createLessonSchema, "body"),
  createLesson
);

// PATCH /api/timetable/lessons/:lessonId

router.patch(
  "/lessons/:lessonId",
  protectRoutes,
  allowRoles("STAFF"),
  validate(lessonParamsSchema, "params"),
  validate(updateLessonSchema, "body"),
  updateLesson
);

// DELETE /api/timetable/lessons/:lessonId

router.delete(
  "/lessons/:lessonId",
  protectRoutes,
  allowRoles("STAFF"),
  validate(lessonParamsSchema, "params"),
  deleteLesson
);

export default router;