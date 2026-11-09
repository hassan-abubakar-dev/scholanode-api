import express from "express";
import { getSubscriptionOverview } from "../controllers/subscription.js";
import { protectRoutes, authorizeSchoolManagement } from "../middleware/auth.js";

const router = express.Router();

// ========================================
// GET SUBSCRIPTION OVERVIEW
// ========================================

router.get(
  "/overview",
  protectRoutes,
  authorizeSchoolManagement,
  getSubscriptionOverview
);

export default router;