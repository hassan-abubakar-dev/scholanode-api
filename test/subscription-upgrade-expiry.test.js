// Run: node --experimental-test-module-mocks --test test/subscription-upgrade-expiry.test.js
import assert from "node:assert/strict";
import { mock, test } from "node:test";

const School = {
  findByPk: async () => null,
};
const SubscriptionPlan = {
  findOne: async () => null,
  create: async () => null,
};
const Student = {
  count: async () => 0,
};
const Payment = {};

mock.module("../relationships/associations.js", {
  namedExports: { School, SubscriptionPlan, Student, Payment },
});

const {
  assertPaidSubscriptionSelection,
  createPaidSubscriptionFromVerifiedPayment,
} = await import("../services/subscription.js");

const starterTier = {
  plan: "STARTER",
  tierId: "STARTER_1_300",
  billingCycle: "MONTHLY",
  minStudents: 1,
  maxStudents: 300,
  price: 200,
};

const standardTier = {
  plan: "STANDARD",
  tierId: "STANDARD_1_500",
  billingCycle: "MONTHLY",
  minStudents: 1,
  maxStudents: 500,
  price: 300,
};

const activeSubscription = (overrides = {}) => ({
  id: "subscription-1",
  plan: "STARTER",
  tierId: "STARTER_1_300",
  billingCycle: "MONTHLY",
  status: "ACTIVE",
  subscriptionEndsAt: new Date("2026-12-01T00:00:00.000Z"),
  trialEndsAt: null,
  ...overrides,
});

test("active subscriptions allow only a higher level and reject same tier or downgrade", () => {
  assert.equal(assertPaidSubscriptionSelection({
    currentSubscription: activeSubscription(),
    targetPricing: standardTier,
    at: new Date("2026-11-14T00:00:00.000Z"),
  }), false);

  assert.throws(() => assertPaidSubscriptionSelection({
    currentSubscription: activeSubscription(),
    targetPricing: starterTier,
    at: new Date("2026-11-14T00:00:00.000Z"),
  }), /not an upgrade/);

  assert.throws(() => assertPaidSubscriptionSelection({
    currentSubscription: activeSubscription({
      plan: "STANDARD",
      tierId: "STANDARD_1_500",
    }),
    targetPricing: starterTier,
    at: new Date("2026-11-14T00:00:00.000Z"),
  }), /cannot downgrade/);
});

test("expired subscriptions may select any paid tier, including a lower tier", () => {
  assert.equal(assertPaidSubscriptionSelection({
    currentSubscription: activeSubscription({
      subscriptionEndsAt: new Date("2026-11-01T00:00:00.000Z"),
    }),
    targetPricing: starterTier,
    at: new Date("2026-11-14T00:00:00.000Z"),
  }), true);

  assert.equal(assertPaidSubscriptionSelection({
    currentSubscription: activeSubscription({ status: "EXPIRED" }),
    targetPricing: starterTier,
    at: new Date("2026-11-14T00:00:00.000Z"),
  }), true);
});

test("expired time is evaluated at verified payment time", () => {
  assert.equal(assertPaidSubscriptionSelection({
    currentSubscription: activeSubscription({
      subscriptionEndsAt: new Date("2026-11-14T12:00:00.000Z"),
    }),
    targetPricing: starterTier,
    at: new Date("2026-11-14T12:00:00.000Z"),
  }), true);

  assert.throws(() => assertPaidSubscriptionSelection({
    currentSubscription: activeSubscription({
      subscriptionEndsAt: new Date("2026-11-14T12:00:00.000Z"),
    }),
    targetPricing: starterTier,
    at: new Date("2026-11-14T11:59:59.999Z"),
  }), /not an upgrade/);
});

test("suspended subscriptions are never eligible for payment", () => {
  for (const overrides of [
    { status: "SUSPENDED" },
    {
      status: "SUSPENDED",
      subscriptionEndsAt: new Date("2026-11-01T00:00:00.000Z"),
    },
  ]) {
    assert.throws(() => assertPaidSubscriptionSelection({
      currentSubscription: activeSubscription(overrides),
      targetPricing: starterTier,
      at: new Date("2026-11-14T00:00:00.000Z"),
    }), /suspended subscription/);
  }
});

const paymentFor = (paidAt, targetPricing = starterTier) => ({
  id: "payment-1",
  schoolId: "school-1",
  reference: "PAYMENT-1",
  amount: targetPricing.price,
  paidAt,
  metadata: {
    purpose: "SUBSCRIPTION_UPGRADE",
    schoolId: "school-1",
    plan: targetPricing.plan,
    tierId: targetPricing.tierId,
    billingCycle: targetPricing.billingCycle,
    minStudents: targetPricing.minStudents,
    maxStudents: targetPricing.maxStudents,
    previousSubscriptionId: "subscription-1",
    previousPlan: "STARTER",
    previousTierId: "STARTER_1_300",
    previousBillingCycle: "MONTHLY",
  },
});

const transaction = {
  finished: false,
  LOCK: { UPDATE: "UPDATE" },
};

test("verified payment after expiry renews from paidAt and keeps the subscription identity check", async (t) => {
  const school = { id: "school-1", status: "ACTIVE" };
  const currentSubscription = activeSubscription({
    subscriptionEndsAt: new Date("2026-11-14T11:00:00.000Z"),
  });
  t.mock.method(School, "findByPk", async () => school);
  t.mock.method(SubscriptionPlan, "findOne", async () => currentSubscription);
  t.mock.method(Student, "count", async () => 10);
  const update = t.mock.fn(async (values) => {
    Object.assign(currentSubscription, values);
    return currentSubscription;
  });
  currentSubscription.update = update;
  const paidAt = new Date("2026-11-14T12:00:00.000Z");

  await createPaidSubscriptionFromVerifiedPayment({
    payment: paymentFor(paidAt),
    transaction,
  });

  assert.equal(update.mock.callCount(), 1);
  assert.equal(currentSubscription.plan, "STARTER");
  assert.equal(
    currentSubscription.subscriptionEndsAt.getTime(),
    new Date("2026-11-14T12:05:00.000Z").getTime()
  );

  await assert.rejects(
    createPaidSubscriptionFromVerifiedPayment({
      payment: {
        ...paymentFor(paidAt),
        metadata: {
          ...paymentFor(paidAt).metadata,
          previousSubscriptionId: "replaced-subscription",
        },
      },
      transaction,
    }),
    /subscription has changed/
  );
});

test("expired school subscription may repurchase a lower tier; suspended school cannot be reactivated", async (t) => {
  const school = { id: "school-1", status: "ACTIVE" };
  const currentSubscription = activeSubscription({
    plan: "STANDARD",
    tierId: "STANDARD_1_500",
    subscriptionEndsAt: new Date("2026-11-01T00:00:00.000Z"),
  });
  t.mock.method(School, "findByPk", async () => school);
  t.mock.method(SubscriptionPlan, "findOne", async () => currentSubscription);
  t.mock.method(Student, "count", async () => 10);
  const update = t.mock.fn(async (values) => {
    Object.assign(currentSubscription, values);
    return currentSubscription;
  });
  currentSubscription.update = update;
  const payment = paymentFor(new Date("2026-11-14T12:00:00.000Z"));
  payment.metadata.previousPlan = "STANDARD";
  payment.metadata.previousTierId = "STANDARD_1_500";

  await createPaidSubscriptionFromVerifiedPayment({ payment, transaction });
  assert.equal(update.mock.callCount(), 1);
  assert.equal(currentSubscription.plan, "STARTER");

  const suspendedSchool = { id: "school-1", status: "SUSPENDED" };
  t.mock.method(School, "findByPk", async () => suspendedSchool);
  await assert.rejects(
    createPaidSubscriptionFromVerifiedPayment({
      payment,
      transaction,
    }),
    /Only active schools/
  );
  assert.equal(suspendedSchool.status, "SUSPENDED");
});

test("initial payment cannot reactivate a suspended school", async (t) => {
  const school = {
    id: "school-1",
    status: "SUSPENDED",
    selectedPlan: "STARTER",
    selectedTierId: "STARTER_1_300",
    selectedBillingCycle: "MONTHLY",
  };
  t.mock.method(School, "findByPk", async () => school);
  t.mock.method(SubscriptionPlan, "findOne", async () => null);

  const payment = paymentFor(new Date("2026-11-14T12:00:00.000Z"));
  payment.metadata.purpose = "INITIAL_ACTIVATION";

  await assert.rejects(
    createPaidSubscriptionFromVerifiedPayment({ payment, transaction }),
    /pending activation/
  );
  assert.equal(school.status, "SUSPENDED");
});
