
import express from "express";

import {
  createSecurityPersonnel,
  getSecurityPersonnel,
  updateSecurityPersonnel,
  deactivateSecurityPersonnel,
  activateSecurityPersonnel,
} from "../controllers/gateSecurity.js";

import {
  createSecurityPersonnelSchema,
  updateSecurityPersonnelSchema,
} from "../validation/gateSecurity.js";

import {
  authorize,
  protectRoutes,
} from "../middleware/auth.js";

import validate from "../middleware/validation.js";

const router = express.Router();

// Create a security account.
router.post(
  "/",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  validate(createSecurityPersonnelSchema, "body"),
  createSecurityPersonnel
);

// List security accounts for the authenticated school.
router.get(
  "/",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  getSecurityPersonnel
);

// Update permitted security account details.
router.patch(
  "/:securityId",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  validate(updateSecurityPersonnelSchema, "body"),
  updateSecurityPersonnel
);

// Deactivate a security account.
router.patch(
  "/:securityId/deactivate",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  deactivateSecurityPersonnel
);

// Reactivate an inactive security account.
router.patch(
  "/:securityId/activate",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  activateSecurityPersonnel
);

export default router;
