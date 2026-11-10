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

  if (!Array.isArray(planPricing)) {
    throw new Error(`Pricing tiers for plan ${String(plan).toUpperCase()} are not configured.`);
  }

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
  if (!plan) throw new Error("Plan is required.");

  const normalizedPlan = plan.toUpperCase();
  const normalizedBillingCycle = billingCycle?.toUpperCase() || null;

  if (normalizedPlan === "FREE") {
    if (tierId != null || billingCycle != null) {
      throw new Error("FREE subscriptions do not accept a tier or billing cycle.");
    }

    return {
      plan: "FREE",
      tierId: null,
      minStudents: null,
      maxStudents: pricingConfig.FREE.maxStudents,
      billingCycle: null,
      price: pricingConfig.FREE.price,
      asLowAs: null,
      message: null,
    };
  }

  if (!tierId || !normalizedBillingCycle) {
    throw new Error("Paid plans require a tier ID and billing cycle.");
  }

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

const PLAN_RANK = Object.freeze({
  FREE: 0,
  STARTER: 1,
  STANDARD: 2,
  PROFESSIONAL: 3,
});

/**
 * Compare two subscription levels.
 *
 * Returns:
 *  1  = target is higher
 *  0  = equivalent level
 * -1  = target is lower
 *
 * Plan rank takes priority.
 * Within the same plan, student capacity determines the level.
 */
export const compareSubscriptionLevels = ({
  currentPlan,
  currentTierId,
  targetPlan,
  targetTierId,
}) => {
  const current = String(currentPlan || "").toUpperCase();
  const target = String(targetPlan || "").toUpperCase();

  if (
    !Object.prototype.hasOwnProperty.call(PLAN_RANK, current) ||
    !Object.prototype.hasOwnProperty.call(PLAN_RANK, target)
  ) {
    throw new Error("Invalid subscription plan.");
  }

  const currentRank = PLAN_RANK[current];
  const targetRank = PLAN_RANK[target];

  // A higher plan is always a higher subscription level.
  if (targetRank > currentRank) return 1;

  // A lower plan is never an upgrade.
  if (targetRank < currentRank) return -1;

  // Same plan: FREE cannot upgrade to another FREE tier.
  if (current === "FREE") return 0;

  // Same paid plan: compare student capacity.
  const currentTier = findPricingTier(current, currentTierId);
  const targetTier = findPricingTier(target, targetTierId);

  const currentCapacity =
    currentTier.maxStudents === null
      ? Infinity
      : Number(currentTier.maxStudents);

  const targetCapacity =
    targetTier.maxStudents === null
      ? Infinity
      : Number(targetTier.maxStudents);

  if (targetCapacity > currentCapacity) return 1;
  if (targetCapacity < currentCapacity) return -1;

  return 0;
};

/**
 * Validate that a requested subscription is a genuine upgrade.
 */
export const assertSubscriptionUpgrade = ({
  currentSubscription,
  targetPricing,
}) => {
  if (!currentSubscription || !targetPricing) {
    throw new Error("Current subscription and target pricing are required.");
  }

  const comparison = compareSubscriptionLevels({
    currentPlan: currentSubscription.plan,
    currentTierId: currentSubscription.tierId,
    targetPlan: targetPricing.plan,
    targetTierId: targetPricing.tierId,
  });

  if (comparison < 0) {
    throw new Error("You cannot downgrade your subscription.");
  }

  if (comparison === 0) {
    throw new Error(
      "The selected subscription is not an upgrade. Choose a higher plan or student capacity."
    );
  }

  return true;
};