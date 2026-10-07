import express from "express";
import {
  verifyNewSchoolAccount, verifyRecoveryCode
} from "../controllers/verification.js";

const router = express.Router();

router.post("/owner-email/verify", verifyNewSchoolAccount);

router.post("/verify-recovery-code", verifyRecoveryCode);

export default router;