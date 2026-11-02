import express from "express";

import {
  checkSchoolCode,
  registerSchool,
  getSchoolSetupProgress,
  getSchoolByCode,
  getMySchool,
  updateSchoolSetup,
  requestSchoolLogoUpload,
  confirmSchoolLogoUpload,
  createAcademicSetup,  
  createClassSetup,
  createSubjectSetup
} from "../controllers/school.js";

import { authorize, protectRoutes } from "../middleware/auth.js";
import validate from "../middleware/validation.js";
import {
  registerSchoolValidationSchema,
  schoolCodeQuerySchema,
  schoolCodeParamSchema,
  updateSchoolSetupSchema,
  schoolLogoUploadUrlValidationSchema,
  confirmSchoolLogoUploadValidationSchema,
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

// administratives get school for school profile rendering
router.get(
  "/my-school",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  getMySchool
);

// Update school setup (optional fields)
router.patch(
  "/my-school/setup",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  validate(updateSchoolSetupSchema, "body"),
  updateSchoolSetup
);

// Request a signed upload URL for a new school logo
router.post(
  "/my-school/logo/upload-url",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  validate(schoolLogoUploadUrlValidationSchema, "body"),
  requestSchoolLogoUpload
);

// Confirm the uploaded school logo
router.patch(
  "/my-school/logo",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  validate(confirmSchoolLogoUploadValidationSchema, "body"),
  confirmSchoolLogoUpload
);

// Create academic setup for a school
router.post(
  "/my-school/academic-setup",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  validate(academicSetupValidationSchema, "body"),
  createAcademicSetup
);

// Create class setup for a school
router.post(
  "/my-school/class-setup",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  validate(classSetupValidationSchema, "body"),
  createClassSetup
);

// Create subject setup for a school
router.post(
  "/my-school/subject-setup",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  validate(subjectSetupValidationSchema, "body"),
  createSubjectSetup
);


export default router;
