import express from "express";
import { protectRoutes } from "../middleware/auth.js";
import validate from "../middleware/validation.js";

import {
  getTimetable,
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
| Get Timetable
|--------------------------------------------------------------------------
*/

// GET /api/timetable?classId=<classId>
router.get(
  "/",
  protectRoutes,
  validate(timetableQuerySchema, "query"),
  getTimetable
);

/*
|--------------------------------------------------------------------------
| Timetable Periods
|--------------------------------------------------------------------------
*/

// POST /api/timetable/periods
router.post(
  "/periods",
  protectRoutes,
  validate(createPeriodSchema, "body"),
  createPeriod
);

// PATCH /api/timetable/periods/:periodId
router.patch(
  "/periods/:periodId",
  protectRoutes,
  validate(periodParamsSchema, "params"),
  validate(updatePeriodSchema, "body"),
  updatePeriod
);

// DELETE /api/timetable/periods/:periodId
router.delete(
  "/periods/:periodId",
  protectRoutes,
  validate(periodParamsSchema, "params"),
  deletePeriod
);

/*
|--------------------------------------------------------------------------
| Timetable Lessons
|--------------------------------------------------------------------------
*/

// POST /api/timetable/lessons
router.post(
  "/lessons",
  protectRoutes,
  validate(createLessonSchema, "body"),
  createLesson
);

// PATCH /api/timetable/lessons/:lessonId
router.patch(
  "/lessons/:lessonId",
  protectRoutes,
  validate(lessonParamsSchema, "params"),
  validate(updateLessonSchema, "body"),
  updateLesson
);

// DELETE /api/timetable/lessons/:lessonId
router.delete(
  "/lessons/:lessonId",
  protectRoutes,
  validate(lessonParamsSchema, "params"),
  deleteLesson
);

export default router;