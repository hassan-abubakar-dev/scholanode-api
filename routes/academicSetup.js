import express from "express";
import {
  createSessionWithTerms,
  createClass,
  createSubject,
  saveWorkingDays,
  getAcademicSetupProgress,
} from "../controllers/academicSetup.js";
import { protectRoutes } from "../middleware/auth.js";
import validate from "../middleware/validation.js";
import {
  createSessionWithTermsSchema,
  createClassSchema,
  createSubjectSchema,
} from "../validation/academicSetup.js";

const router = express.Router();

// Create academic session with its three terms
router.post(
  "/session",
  protectRoutes,
  validate(createSessionWithTermsSchema, "body"),
  createSessionWithTerms
);

// Create class and arm
router.post(
  "/class",
  protectRoutes,
  validate(createClassSchema, "body"),
  createClass
);

// Create subject
router.post(
  "/subject",
  protectRoutes,
  validate(createSubjectSchema, "body"),
  createSubject
);

// Save working days
router.post(
  "/working-days",
  protectRoutes,
  saveWorkingDays
);  

router.get(
  "/progress",
  protectRoutes,
  getAcademicSetupProgress
);

export default router;