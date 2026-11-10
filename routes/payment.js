import express from "express";

import {
  initializePayment,
  initializeUpgradePayment,
  getPaymentStatus,
  getPaymentHistory,
  getPaymentReceipt,
} from "../controllers/payment.js";

import validate from "../middleware/validation.js";
import { protectRoutes, authorizeSchoolManagement } from "../middleware/auth.js";

import {
  initializePaymentParamSchema,
  initializePaymentBodySchema,
  paymentStatusParamSchema,
  paymentHistoryQuerySchema,
  paymentReceiptParamSchema,
} from "../validation/payment.js";

const router = express.Router();

// ========================================
// INITIALIZE PAYMENT
// ========================================

router.post(
  "/schools/:schoolId/initialize",
  protectRoutes,
  authorizeSchoolManagement,
  validate(initializePaymentParamSchema, "params"),
  validate(initializePaymentBodySchema, "body"),
  initializePayment
);

// ========================================
// INITIALIZE UPGRADE PAYMENT
// ========================================
router.post(
  "/schools/:schoolId/upgrade/initialize",
  protectRoutes,
  authorizeSchoolManagement,
  validate(initializePaymentParamSchema, "params"),
  validate(initializePaymentBodySchema, "body"),
  initializeUpgradePayment
);

// ========================================
// GET PAYMENT HISTORY
// ========================================

router.get(
  "/history",
  protectRoutes,
  authorizeSchoolManagement,
  validate(paymentHistoryQuerySchema, "query"),
  getPaymentHistory
);

// ========================================
// GET PAYMENT RECEIPT
// ========================================

router.get(
  "/:paymentId/receipt",
  protectRoutes,
  authorizeSchoolManagement,
  validate(paymentReceiptParamSchema, "params"),
  getPaymentReceipt
);

// ========================================
// GET PAYMENT STATUS
// ========================================

router.get(
  "/:reference/status",
  protectRoutes,
  authorizeSchoolManagement,
  validate(paymentStatusParamSchema, "params"),
  getPaymentStatus
);

export default router;