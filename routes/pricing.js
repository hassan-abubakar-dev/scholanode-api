import express from "express";
import {
  getPricingByPlan,
  resolvePricingSelection,
} from "../controllers/pricing.js";
import validate from "../middleware/validation.js";
import {
  planParamSchema,
  resolvePricingSchema,
} from "../validation/pricing.js";

const router = express.Router();

router.post(
  "/resolve",
  validate(resolvePricingSchema, "body"),
  resolvePricingSelection
);

router.get(
  "/:plan",
  validate(planParamSchema, "params"),
  getPricingByPlan
);

export default router;