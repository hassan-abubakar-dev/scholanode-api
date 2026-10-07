import express from "express";

import {
  getPricingByPlan,
  resolvePricingSelection,
} from "../controllers/pricing.js"; 

const router = express.Router();

router.post("/resolve", resolvePricingSelection);

router.get("/:plan", getPricingByPlan); 

export default router;