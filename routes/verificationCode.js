import express from "express";
import {
  verifyNewSchoolAccount,
  verifyRecoveryCode,
} from "../controllers/verification.js";
import validate from "../middleware/validation.js";
import {
  verifyAccountValidationSchema,
  verifyRecoveryCodeValidationSchema,
} from "../validation/verification.js";

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

export default router;