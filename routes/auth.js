import express from "express";
import {
  loginUser,
  getLoggedInUser,
  forgotLoginId,
  forgotPassword,
  resetPassword,
  requestNewAccessToken,
  logOutUser
} from "../controllers/auth.js";
import { protectRoutes } from "../middleware/auth.js";
import validate from "../middleware/validation.js";
import {
  loginValidationSchema,
  forgotLoginIdValidationSchema,
  forgotPasswordValidationSchema,
  resetPasswordValidationSchema,
} from "../validation/auth.js";

const router = express.Router();

// Current logged-in user profile
router.get("/me", protectRoutes, getLoggedInUser);
router.get("/logged-in-user", protectRoutes, getLoggedInUser);

// Login and token refresh
router.post("/login", validate(loginValidationSchema, "body"), loginUser);
router.post("/refresh-token", requestNewAccessToken);

// Password and Login ID recovery
router.post(
  "/forgot-login-id",
  validate(forgotLoginIdValidationSchema, "body"),
  forgotLoginId
);
router.post(
  "/forgot-password",
  validate(forgotPasswordValidationSchema, "body"),
  forgotPassword
);
router.post(
  "/reset-password",
  validate(resetPasswordValidationSchema, "body"),
  resetPassword
);

router.post('/log-out', protectRoutes, logOutUser);

export default router;