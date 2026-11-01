import express from "express";

import {
    updateProfile,
    requestEmailChange,
    verifyEmailChange,
    requestProfileImageUpload,
    confirmProfileImageUpload
} from "../controllers/profile.js"; 

import { protectRoutes } from "../middleware/auth.js";
import validate from "../middleware/validation.js";

import {
    updateProfileValidationSchema,
    requestEmailChangeValidationSchema,
    verifyEmailChangeValidationSchema,
    profileImageUploadUrlValidationSchema,
    confirmProfileImageUploadValidationSchema,
} from "../validation/profile.js";

const router = express.Router();

// PROFILE IMAGE UPLOAD
router.post(
    "/image/upload-url",
    protectRoutes,
    validate(profileImageUploadUrlValidationSchema, "body"),
    requestProfileImageUpload
);

// CONFIRM PROFILE IMAGE UPLOAD
router.patch(
    "/image/confirm",
    protectRoutes,
    validate(confirmProfileImageUploadValidationSchema, "body"),
    confirmProfileImageUpload
);

router.patch(
    "/",
    protectRoutes,
    validate(updateProfileValidationSchema, "body"),
    updateProfile
);

router.post(
    "/email-change/request",
    protectRoutes,
    validate(requestEmailChangeValidationSchema, "body"),
    requestEmailChange
);

router.post(
    "/email-change/verify",
    protectRoutes,
    validate(verifyEmailChangeValidationSchema, "body"),
    verifyEmailChange
);

export default router;