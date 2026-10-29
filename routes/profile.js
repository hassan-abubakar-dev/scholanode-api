import express from "express";

import {
    updateProfile,
    requestEmailChange,
    verifyEmailChange,
} from "../controllers/profile.js"; 

import { protectRoutes } from "../middleware/auth.js";
import validate from "../middleware/validation.js";

import {
    updateProfileValidationSchema,
    requestEmailChangeValidationSchema,
    verifyEmailChangeValidationSchema,
} from "../validation/profile.js";

const router = express.Router();

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