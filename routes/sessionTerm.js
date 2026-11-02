import express from "express";
import { authorize, protectRoutes } from "../middleware/auth.js";
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
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  getAllSessionsAndTerms
);

// Update a session with its terms
router.patch(
  "/session/:sessionId",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  validate(sessionParamsSchema, "params"),
  validate(updateSessionWithTermsSchema, "body"),
  updateSessionWithTerms
);


// Session lifecycle.
router.patch(
  "/:sessionId/activate",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  validate(sessionParamsSchema, "params"),
  activateSession
);

router.patch(
  "/:sessionId/complete",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  validate(sessionParamsSchema, "params"),
  completeSession
);

// Term lifecycle.
router.patch(
  "/:sessionId/terms/:termId/activate",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  validate(sessionTermParamsSchema, "params"),
  activateTerm
);

router.patch(
  "/:sessionId/terms/:termId/complete",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  validate(sessionTermParamsSchema, "params"),
  completeTerm
);

export default router;