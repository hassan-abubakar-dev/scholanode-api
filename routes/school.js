import express from "express";

import {
  checkSchoolCode,
  registerSchool,
  getSchoolSetupProgress,
  getSchoolByCode,
  getMySchool,
  updateSchoolSetup,
  createAcademicSetup,  
  createClassSetup,
  createSubjectSetup
} from "../controllers/school.js";

import { protectRoutes } from "../middleware/auth.js";
import validate from "../middleware/validation.js";
import {
  registerSchoolValidationSchema,
  schoolCodeQuerySchema,
  schoolCodeParamSchema,
  schoolIdParamSchema,
  updateSchoolSetupSchema,
  academicSetupValidationSchema,
  classSetupValidationSchema,
  subjectSetupValidationSchema,
} from "../validation/school.js";

const router = express.Router();

// Register new school with admin and plan
router.post(
  "/register",
  validate(registerSchoolValidationSchema, "body"),
  registerSchool
);

router.get(
  "/setup-progress",
  protectRoutes,
  getSchoolSetupProgress
);


// Check whether a school code is available
router.get(
  "/check-code",
  validate(schoolCodeQuerySchema, "query"),
  checkSchoolCode
);




// Get school by code
router.get(
  "/get/:code",
  validate(schoolCodeParamSchema, "params"),
  getSchoolByCode
);

// Get the logged-in user's school
router.get(
  "/my-school",
  protectRoutes,
  getMySchool
);

// Update school setup (optional fields)
router.patch(
  "/:id/setup",
  protectRoutes,
  validate(schoolIdParamSchema, "params"),
  validate(updateSchoolSetupSchema, "body"),
  updateSchoolSetup
);

// Create academic setup for a school
router.post(
  "/:id/academic-setup",
  protectRoutes,
  validate(schoolIdParamSchema, "params"),
  validate(academicSetupValidationSchema, "body"),
  createAcademicSetup
);

// Create class setup for a school
router.post(
  "/:id/class-setup",
  protectRoutes,
  validate(schoolIdParamSchema, "params"),
  validate(classSetupValidationSchema, "body"),
  createClassSetup
);

// Create subject setup for a school
router.post(
  "/:id/subject-setup",
  protectRoutes,
  validate(schoolIdParamSchema, "params"),
  validate(subjectSetupValidationSchema, "body"),
  createSubjectSetup
);


export default router;
