import express from "express";

import { protectRoutes } from "../middleware/auth.js";
import validate from "../middleware/validation.js";

import {
  getMyNotifications,
  getUnreadNotificationCount,
} from "../controllers/notification.js";

import {
  notificationQuerySchema,
} from "../validation/notification.js";

const router = express.Router();

// Get unread notification count
router.get(
  "/unread-count",
  protectRoutes,
  getUnreadNotificationCount
);

// Get notifications for the authenticated user
router.get(
  "/my",
  protectRoutes,
  validate(notificationQuerySchema, "query"),
  getMyNotifications
);

export default router;