
const pricingConfig = {
  FREE: {
    plan: "FREE",
    maxStudents: null,
    trialDays: 120,
    trialMinutes: 5, // TEMPORARY TEST: 5 minutes
    status: "TRIAL",
    billingCycle: null,
    price: 0,
    isAutoRenew: false,
  },

  STARTER: [
    {
      id: "STARTER_1_300",
      minStudents: 1,
      maxStudents: 300,
      MONTHLY: { price: 200, asLowAs: 1.67 },
      TERMLY: { price: 600, asLowAs: 2 },
      YEARLY: { price: 700, asLowAs: 2.33 },
    },
    {
      id: "STARTER_301_500",
      minStudents: 301,
      maxStudents: 500,
      MONTHLY: { price: 300, asLowAs: 1.6 },
      TERMLY: { price: 900, asLowAs: 1.8 },
      YEARLY: { price: 1000, asLowAs: 2 },
    },
    {
      id: "STARTER_501_700",
      minStudents: 501,
      maxStudents: 700,
      MONTHLY: { price: 100, asLowAs: 1.57 },
      TERMLY: { price: 1200, asLowAs: 1.71 },
      YEARLY: { price: 1300, asLowAs: 1.86 },
    },
    {
      id: "STARTER_701_1000",
      minStudents: 701,
      maxStudents: 1000,
      MONTHLY: { price: 1400, asLowAs: 1.4 },
      TERMLY: { price: 1500, asLowAs: 1.5 },
      YEARLY: { price: 1600, asLowAs: 1.6 },
    },
    {
      id: "STARTER_1001_1500",
      minStudents: 1001,
      maxStudents: 1500,
      MONTHLY: { price: 1700, asLowAs: 1.13 },
      TERMLY: { price: 1800, asLowAs: 1.2 },
      YEARLY: { price: 1900, asLowAs: 1.27 },
    },
    {
      id: "STARTER_1501_2000",
      minStudents: 1501,
      maxStudents: 2000,
      MONTHLY: { price: 2000, asLowAs: 1 },
      TERMLY: { price: 2100, asLowAs: 1.05 },
      YEARLY: { price: 2200, asLowAs: 1.1 },
    },
    {
      id: "STARTER_2001_UNLIMITED",
      minStudents: 2001,
      maxStudents: null,
      MONTHLY: { price: 2300, asLowAs: null },
      TERMLY: { price: 2400, asLowAs: null },
      YEARLY: { price: 2500, asLowAs: null },
      message: "Price based on your number of students",
    },
  ],

  STANDARD: [],

  PROFESSIONAL: [],
};

// TEMPORARY TEST CONFIGURATION
export const SUBSCRIPTION_TEST_DURATION_MINUTES = 5;

export const SUBSCRIPTION_DURATIONS_DAYS = Object.freeze({
  MONTHLY: 30,
  TERMLY: 90,
  YEARLY: 360,
});

const calculateExpiry = (startDate, durationDays) => {
  const date = new Date(startDate);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid subscription start date");
  }

  return new Date(date.getTime() + durationDays * 24 * 60 * 60 * 1000);
};

export const calculateSubscriptionExpiry = (
  billingCycle,
  startDate = new Date()
) => {
  const days = SUBSCRIPTION_DURATIONS_DAYS[billingCycle];

  if (!days) {
    throw new Error(
      `Invalid billing cycle for duration calculation: ${billingCycle}`
    );
  }

  const date = new Date(startDate);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid subscription start date");
  }

  return new Date(
    date.getTime() + SUBSCRIPTION_TEST_DURATION_MINUTES * 60 * 1000
  );
};

export const calculateTrialExpiry = (startDate = new Date()) => {
  const date = new Date(startDate);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid subscription start date");
  }

  return new Date(
    date.getTime() + pricingConfig.FREE.trialMinutes * 60 * 1000
  );
};

export default pricingConfig;
