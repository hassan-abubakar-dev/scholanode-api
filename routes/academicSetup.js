import express from "express";
import {
  createSessionWithTerms,
  createClass,
  createSubject,
  saveWorkingDays,
  getAcademicSetupProgress,
} from "../controllers/academicSetup.js";
import { authorize, protectRoutes } from "../middleware/auth.js";
import validate from "../middleware/validation.js";
import {
  createSessionWithTermsSchema,
  createClassSchema,
  createSubjectSchema,
  saveWorkingDaysSchema,
} from "../validation/academicSetup.js";

const router = express.Router();

// Create academic session with its three terms
router.post(
  "/session",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  validate(createSessionWithTermsSchema, "body"),
  createSessionWithTerms
);

// Create class and arm
router.post(
  "/class",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  validate(createClassSchema, "body"),
  createClass
);

// Create subject
router.post(
  "/subject",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  validate(createSubjectSchema, "body"),
  createSubject
);

// Save working days
router.post(
  "/working-days",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  validate(saveWorkingDaysSchema, "body"),
  saveWorkingDays
);

router.get(
  "/progress",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  getAcademicSetupProgress
);

export default router;