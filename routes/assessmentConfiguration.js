
import express from "express";

import {
  protectRoutes,
  authorize,
} from "../middleware/auth.js";

import validate from "../middleware/validation.js";

import {
  getAssessmentSections,
  getAssessmentConfigurations,
  updateAssessmentConfiguration,
  getAssessmentConfigurationHistory,
} from "../controllers/assessmentConfiguration.js";

import {
  educationSectionParamsSchema,
  assessmentConfigurationsQuerySchema,
  updateAssessmentConfigurationSchema,
} from "../validation/assessmentConfiguration.js";

const router = express.Router();

router.use(protectRoutes);

// 1. Get actual educational sections, classes, arms,
// and their assessment configuration status.
router.get(
  "/sections",
  getAssessmentSections
);

// 2. Get all configurations or filter by educational section.
router.get(
  "/",
  validate(assessmentConfigurationsQuerySchema, "query"),
  getAssessmentConfigurations
);

// 3. Create a new pending assessment configuration version.
router.put(
  "/sections/:educationSection",
  authorize("LEADER", "VICE_LEADER", "EXAM_OFFICER"),
  validate(educationSectionParamsSchema, "params"),
  validate(updateAssessmentConfigurationSchema, "body"),
  updateAssessmentConfiguration
);

// 4. Get configuration version history for a section.
router.get(
  "/sections/:educationSection/history",
  validate(educationSectionParamsSchema, "params"),
  getAssessmentConfigurationHistory
);

export default router;
