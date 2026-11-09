import express from "express";
import {
  verifyNewSchoolAccount,
  verifyRecoveryCode,
  resendSchoolRegistrationCode,
  resendPasswordResetCode,
} from "../controllers/verification.js";

import {
  verifyAccountValidationSchema,
  verifyRecoveryCodeValidationSchema,
  resendRegistrationCodeValidationSchema,
  resendPasswordResetCodeValidationSchema,
} from "../validation/verification.js";

import validate from "../middleware/validation.js";

const router = express.Router();

router.post(
  "/owner-email/verify",
  validate(verifyAccountValidationSchema, "body"),
  verifyNewSchoolAccount
);

router.post(
  "/verify-recovery-code",
  validate(verifyRecoveryCodeValidationSchema, "body"),
  verifyRecoveryCode
);

router.post(
  "/owner-email/resend",
  validate(resendRegistrationCodeValidationSchema, "body"),
  resendSchoolRegistrationCode
);

router.post(
  "/password-reset/resend",
  validate(resendPasswordResetCodeValidationSchema, "body"),
  resendPasswordResetCode
);

export default router;