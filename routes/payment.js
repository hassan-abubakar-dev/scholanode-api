import express from "express";
import {
  initializePayment,
  getPaymentStatus,
} from "../controllers/payment.js";
import validate from "../middleware/validation.js";
import {
  initializePaymentParamSchema,
  initializePaymentBodySchema,
  paymentStatusParamSchema,
} from "../validation/payment.js";

const router = express.Router();

// ========================================
// INITIALIZE PAYMENT
// ========================================

router.post(
  "/schools/:schoolId/initialize",
  validate(initializePaymentParamSchema, "params"),
  validate(initializePaymentBodySchema, "body"),
  initializePayment
);

// ========================================
// GET PAYMENT STATUS
// ========================================

router.get(
  "/:reference/status",
  validate(paymentStatusParamSchema, "params"),
  getPaymentStatus
);

export default router;