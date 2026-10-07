import express from "express";
import {
  initializePayment,
  getPaymentStatus,
} from "../controllers/payment.js";

const router = express.Router();

// ========================================
// INITIALIZE PAYMENT
// ========================================

router.post("/schools/:schoolId/initialize", initializePayment);

// ========================================
// GET PAYMENT STATUS
// ========================================

router.get("/:reference/status", getPaymentStatus);


export default router;