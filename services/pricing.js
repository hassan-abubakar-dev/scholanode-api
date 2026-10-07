import pricingConfig from "../config/pricing.js";

/**
 * Get pricing information for a specific plan.
 *
 * Example:
 * getPlanPricing("STARTER")
 */
export const getPlanPricing = (plan) => {
  if (!plan) {
    throw new Error("Plan is required.");
  }

  const normalizedPlan = plan.toUpperCase();

  const pricing = pricingConfig[normalizedPlan];

  if (pricing === undefined) {
    throw new Error("Invalid pricing plan.");
  }

  return pricing;
};

/**
 * Find a specific pricing tier inside a plan.
 *
 * Example:
 * findPricingTier("STARTER", "STARTER_1_300")
 */
export const findPricingTier = (plan, tierId) => {
  const planPricing = getPlanPricing(plan);

  const tier = planPricing.find((item) => item.id === tierId);

  if (!tier) {
    throw new Error("Invalid pricing tier.");
  }

  return tier;
};

/**
 * Resolve and validate a pricing selection.
 *
 * The frontend sends ONLY:
 *
 * {
 *   plan,
 *   tierId,
 *   billingCycle
 * }
 *
 * The price is NEVER trusted from the frontend.
 */
export const resolvePricing = ({
  plan,
  tierId,
  billingCycle,
}) => {
  if (!plan || !tierId || !billingCycle) {
    throw new Error(
      "Plan, tier ID and billing cycle are required."
    );
  }

  const normalizedPlan = plan.toUpperCase();
  const normalizedBillingCycle = billingCycle.toUpperCase();

  const tier = findPricingTier(
    normalizedPlan,
    tierId
  );

  const pricing = tier[normalizedBillingCycle];

  if (!pricing) {
    throw new Error(
      "The selected billing cycle is not available for this pricing tier."
    );
  }

  return {
    plan: normalizedPlan,

    tierId: tier.id,

    minStudents: tier.minStudents,

    maxStudents: tier.maxStudents,

    billingCycle: normalizedBillingCycle,

    price: pricing.price,

    asLowAs: pricing.asLowAs,

    message: tier.message || null,
  };
};