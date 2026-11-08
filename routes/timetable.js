import express from "express";

import { protectRoutes } from "../middleware/auth.js";
import validate from "../middleware/validation.js";

import AppError from "../utils/AppError.js";

import {
  getTimetable,
  getSchoolWorkingDays,
  generateTimetablePdf,
  createPeriod,
  updatePeriod,
  deletePeriod,
  createLesson,
  updateLesson,
  deleteLesson,
} from "../controllers/timetable.js";

import {
  timetableQuerySchema,
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
  "STAFF",
];

const LESSON_MANAGEMENT_ROLES = ["STAFF", "LEADER", "VICE_LEADER", "ADMINISTRATOR"];

/*
|--------------------------------------------------------------------------
| Get Timetable
|--------------------------------------------------------------------------
*/

// GET /api/timetable?classId=<classId>
//
// Authorization is checked inside the controller because access
// depends on the requested class and the authenticated user.

router.get(
  "/",
  protectRoutes,
  validate(timetableQuerySchema, "query"),
  getTimetable
);

/*
|--------------------------------------------------------------------------
| Working Days & PDF Routes
|--------------------------------------------------------------------------
*/

// GET /api/timetables/working-days
router.get(
  "/working-days",
  protectRoutes,
  getSchoolWorkingDays
);

// GET /api/timetables/pdf?classId=<classId>
router.get(
  "/pdf",
  protectRoutes,
  validate(timetableQuerySchema, "query"),
  generateTimetablePdf
);


/*
|--------------------------------------------------------------------------
| Timetable Periods
|--------------------------------------------------------------------------
*/

// Shared school-wide period configuration.
// Only school leadership and administrators can manage periods.

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
| Timetable Lessons
|--------------------------------------------------------------------------
*/

// Only STAFF can access these management endpoints.
// The controller additionally verifies that the user is the
// Form Master assigned to the requested class.

// POST /api/timetable/lessons
router.post(
  "/lessons",
  protectRoutes,
  allowRoles(...LESSON_MANAGEMENT_ROLES),
  validate(createLessonSchema, "body"),
  createLesson
);

// PATCH /api/timetable/lessons/:lessonId
router.patch(
  "/lessons/:lessonId",
  protectRoutes,
  allowRoles(...LESSON_MANAGEMENT_ROLES),
  validate(lessonParamsSchema, "params"),
  validate(updateLessonSchema, "body"),
  updateLesson
);

// DELETE /api/timetable/lessons/:lessonId
router.delete(
  "/lessons/:lessonId",
  protectRoutes,
  allowRoles(...LESSON_MANAGEMENT_ROLES),
  validate(lessonParamsSchema, "params"),
  deleteLesson
);

export default router;