import { School, SubscriptionPlan } from "../relationships/associations.js";
import pricingConfig, {
  calculateSubscriptionExpiry,
  calculateTrialExpiry,
} from "../config/pricing.js";
import { resolvePricing } from "./pricing.js";


const requireTransaction = (transaction) => {
  if (!transaction || transaction.finished) {
    throw new Error("An active database transaction is required.");
  }
};

const clearSchoolSelection = async (school, transaction) => {
  school.selectedPlan = null;
  school.selectedTierId = null;
  school.selectedBillingCycle = null;
  await school.save({ transaction });
};

export const createFreeSubscriptionForSchool = async ({
  school,
  transaction,
  verifiedAt = new Date(),
}) => {
  requireTransaction(transaction);

  if (!school) {
    throw new Error("School instance is required to create a free subscription.");
  }

  const selection = resolvePricing({
    plan: school.selectedPlan,
    tierId: school.selectedTierId,
    billingCycle: school.selectedBillingCycle,
  });

  if (selection.plan !== "FREE") {
    throw new Error("The school does not have a valid FREE subscription selection.");
  }

  const existingSubscription = await SubscriptionPlan.findOne({
    where: { schoolId: school.id },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (existingSubscription) {
    throw new Error("A subscription already exists for this school.");
  }

  const subscription = await SubscriptionPlan.create(
    {
      schoolId: school.id,
      plan: "FREE",
      tierId: null,
      billingCycle: null,
      maxStudents: pricingConfig.FREE.maxStudents,
      status: pricingConfig.FREE.status,
      isAutoRenew: false,
      trialEndsAt: calculateTrialExpiry(verifiedAt),
      subscriptionEndsAt: null,
    },
    { transaction }
  );

  await clearSchoolSelection(school, transaction);
  return subscription;
};

export const createPaidSubscriptionFromVerifiedPayment = async ({
  payment,
  transaction,
}) => {
  requireTransaction(transaction);

  if (!payment || !payment.schoolId) {
    throw new Error("A valid Payment instance is required.");
  }

  const metadata = payment.metadata;
  if (metadata?.schoolId !== payment.schoolId) {
    throw new Error("Payment metadata does not match the payment school.");
  }

  const pricing = resolvePricing({
    plan: metadata?.plan,
    tierId: metadata?.tierId,
    billingCycle: metadata?.billingCycle,
  });

  if (pricing.plan === "FREE" || Number(pricing.price) <= 0) {
    throw new Error("FREE plans cannot create paid subscriptions.");
  }

  if (
    metadata.minStudents !== pricing.minStudents ||
    metadata.maxStudents !== pricing.maxStudents
  ) {
    throw new Error("Payment metadata does not match configured pricing.");
  }

  const school = await School.findByPk(payment.schoolId, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (!school) {
    throw new Error(`Associated school not found for payment ${payment.reference}.`);
  }

  if (
    school.selectedPlan !== pricing.plan ||
    String(school.selectedTierId) !== String(pricing.tierId) ||
    school.selectedBillingCycle !== pricing.billingCycle
  ) {
    throw new Error(
      "The payment does not match the school's saved registration selection."
    );
  }

  const expectedAmount = Number(pricing.price);
  if (Number(payment.amount) !== expectedAmount) {
    throw new Error("The payment amount does not match the configured pricing.");
  }

  const paidAt = new Date(payment.paidAt);
  if (Number.isNaN(paidAt.getTime())) {
    throw new Error("A valid verified payment date is required.");
  }

  const existingSubscription = await SubscriptionPlan.findOne({
    where: { schoolId: school.id },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (existingSubscription) {
    throw new Error("A subscription already exists for this school.");
  }

  const subscription = await SubscriptionPlan.create(
    {
      schoolId: school.id,
      plan: pricing.plan,
      tierId: pricing.tierId,
      billingCycle: pricing.billingCycle,
      maxStudents: pricing.maxStudents,
      status: "ACTIVE",
      isAutoRenew: false,
      trialEndsAt: null,
      subscriptionEndsAt: calculateSubscriptionExpiry(
        pricing.billingCycle,
        paidAt
      ),
    },
    { transaction }
  );

  await clearSchoolSelection(school, transaction);
  return subscription;
};
