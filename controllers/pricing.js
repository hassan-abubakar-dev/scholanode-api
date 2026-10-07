import {
  getPlanPricing,
  resolvePricing,
} from "../services/pricing.js"; 

/**
 * Get pricing information for a specific plan.
 *
 * GET /api/pricing/STARTER
 */
export const getPricingByPlan = async (req, res) => {
  try {
    const { plan } = req.params;
    console.log(' Fetching pricing for plan:', plan);

    const pricing = getPlanPricing(plan);

    return res.status(200).json({
      success: true,
      data: pricing,
    });
  } catch (error) {
    console.error("Get pricing by plan error:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Resolve and validate a selected pricing option.
 *
 * POST /api/pricing/resolve
 *
 * Body:
 *
 * {
 *   "plan": "STARTER",
 *   "tierId": "STARTER_1_300",
 *   "billingCycle": "TERMLY"
 * }
 */
export const resolvePricingSelection = async (req, res) => {
  try {
    const {
      plan,
      tierId,
      billingCycle,
    } = req.body;

    const pricing = resolvePricing({
      plan,
      tierId,
      billingCycle,
    });

    return res.status(200).json({
      success: true,
      message: "Pricing selection is valid.",
      data: pricing,
    });
  } catch (error) {
    console.error(
      "Resolve pricing selection error:",
      error
    );

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};