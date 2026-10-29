import express from "express";

import { protectRoutes, authorize } from "../middleware/auth.js";
import validate from "../middleware/validation.js";

import {
    createAnnouncement,
    getAnnouncements,
    getMyAnnouncements,
    deleteAnnouncement,
} from "../controllers/announcement.js";

import {
    announcementParamsSchema,
    createAnnouncementSchema,
    announcementQuerySchema,
} from "../validation/announcement.js";

const router = express.Router();

const announcementManagers = [
    "LEADER",
    "VICE_LEADER",
    "ADMINISTRATOR",
];

// Get announcements for the authenticated user's audience
router.get(
    "/my",
    protectRoutes,
    validate(announcementQuerySchema, "query"),
    getMyAnnouncements
);

// Create an announcement
router.post(
    "/",
    protectRoutes,
    authorize(...announcementManagers),
    validate(createAnnouncementSchema, "body"),
    createAnnouncement
);

// Get all announcements for management
router.get(
    "/",
    protectRoutes,
    authorize(...announcementManagers),
    validate(announcementQuerySchema, "query"),
    getAnnouncements
);

// Delete an announcement and its linked shared notification
router.delete(
    "/:announcementId",
    protectRoutes,
    authorize(...announcementManagers),
    validate(announcementParamsSchema, "params"),
    deleteAnnouncement
);

export default router;