import express from "express";
import {
  createSessionWithTerms,
  createClass,
  createSubject,
  getAcademicSetupProgress
} from "../controllers/academicSetup.js";

import { protectRoutes } from "../middleware/auth.js";

const router = express.Router();

// Create academic session with its three terms
router.post(
  "/session",
  protectRoutes,
  createSessionWithTerms
);

// Create class and arm
router.post(
  "/class",
  protectRoutes,
  createClass
);

// Create subject
router.post(
  "/subject",
  protectRoutes,
  createSubject
);

router.get(
  "/progress",
  protectRoutes,
  getAcademicSetupProgress
);

export default router;