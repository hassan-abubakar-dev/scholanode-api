import {
  getPlanPricing,
  resolvePricing,
} from "../services/pricing.js"; 

/**
 * Get pricing information for a specific plan.
 *
 * GET /api/plans/:plan
 */
export const getPricingByPlan = async (req, res, next) => {
  try {
    const { plan } = req.params;
    const pricing = getPlanPricing(plan);

    return res.status(200).json({
      success: true,
      data: pricing,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Resolve and validate a selected pricing option.
 *
 * POST /api/plans/resolve
 */
export const resolvePricingSelection = async (req, res, next) => {
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
    return next(error);
  }
};