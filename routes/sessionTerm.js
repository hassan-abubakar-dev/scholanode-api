import express from "express";
import {
  authorizeAcademicRead,
  authorizeSchoolManagement,
  protectRoutes,
} from "../middleware/auth.js";
import {
  getAllSessionsAndTerms, updateSessionWithTerms, activateSession, completeSession, activateTerm, completeTerm
} from "../controllers/sessionTerm.js";

import {sessionParamsSchema, sessionTermParamsSchema, updateSessionWithTermsSchema} from "../validation/sessionTerm.js";
import  validate  from "../middleware/validation.js";


const router = express.Router();  


// Get all academic sessions and their terms
router.get(
  "/",
  protectRoutes,
  authorizeAcademicRead,
  getAllSessionsAndTerms
);

// Update a session with its terms
router.patch(
  "/session/:sessionId",
  protectRoutes,
  authorizeSchoolManagement,
  validate(sessionParamsSchema, "params"),
  validate(updateSessionWithTermsSchema, "body"),
  updateSessionWithTerms
);


// Session lifecycle.
router.patch(
  "/:sessionId/activate",
  protectRoutes,
  authorizeSchoolManagement,
  validate(sessionParamsSchema, "params"),
  activateSession
);

router.patch(
  "/:sessionId/complete",
  protectRoutes,
  authorizeSchoolManagement,
  validate(sessionParamsSchema, "params"),
  completeSession
);

// Term lifecycle.
router.patch(
  "/:sessionId/terms/:termId/activate",
  protectRoutes,
  authorizeSchoolManagement,
  validate(sessionTermParamsSchema, "params"),
  activateTerm
);

router.patch(
  "/:sessionId/terms/:termId/complete",
  protectRoutes,
  authorizeSchoolManagement,
  validate(sessionTermParamsSchema, "params"),
  completeTerm
);

export default router;