import express from "express";

import {
  getClassSubjects,
  assignSubjectToClass,
  removeSubjectFromClass,
} from "../controllers/classSubject.js";

import {
  assignSubjectToClassSchema,
} from "../validation/classSubject.js";

import validate from "../middleware/validation.js";
import {
  protectRoutes,
  authorize,
} from "../middleware/auth.js";

const router = express.Router();

router.use(protectRoutes);

router.use(
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR")
);

// Get subjects assigned to a class
router.get(
  "/class/:classId/subjects",
  getClassSubjects
);

// Assign one or multiple subjects to selected class arms
router.post(
  "/class/:classId/subjects",
  validate(assignSubjectToClassSchema, "body"),
  assignSubjectToClass
);

// Remove a subject from a particular class
router.delete(
  "/class/:classId/subjects/:subjectId",
  removeSubjectFromClass
);

export default router;
