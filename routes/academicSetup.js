import express from "express";
import {
  createSessionWithTerms,
  createClass,
  createSubject,
  saveWorkingDays,
  createAssessmentConfiguration,
  getAcademicSetupProgress,
} from "../controllers/academicSetup.js";
import {
  authorizeAcademicManagement,
  authorizeAcademicRead,
  authorizeSchoolManagement,
  protectRoutes,
} from "../middleware/auth.js";
import validate from "../middleware/validation.js";
import {
  createSessionWithTermsSchema,
  createClassSchema,
  createSubjectSchema,
  saveWorkingDaysSchema,
   createAssessmentConfigurationSchema,
} from "../validation/academicSetup.js";

const router = express.Router();

// Create academic session with its three terms
router.post(
  "/session",
  protectRoutes,
  authorizeSchoolManagement,
  validate(createSessionWithTermsSchema, "body"),
  createSessionWithTerms
);

// Create class and arm
router.post(
  "/class",
  protectRoutes,
  authorizeSchoolManagement,
  validate(createClassSchema, "body"),
  createClass
);

// Create subject
router.post(
  "/subject",
  protectRoutes,
  authorizeSchoolManagement,
  validate(createSubjectSchema, "body"),
  createSubject
);

// Save working days
router.post(
  "/working-days",
  protectRoutes,
  authorizeSchoolManagement,
  validate(saveWorkingDaysSchema, "body"),
  saveWorkingDays
);

// Create initial assessment configuration for an educational section
router.post(
  "/assessment-configuration",
  protectRoutes,
  authorizeAcademicManagement,
  validate(createAssessmentConfigurationSchema, "body"),
  createAssessmentConfiguration
);

router.get(
  "/progress",
  protectRoutes,
  authorizeAcademicRead,
  getAcademicSetupProgress
);

export default router;