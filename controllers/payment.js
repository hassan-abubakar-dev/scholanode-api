import axios from "axios";
import crypto from "crypto";
import { Op } from "sequelize";
import {
  Payment,
  School,
  SubscriptionPlan,
  Student,
} from "../relationships/associations.js";

import {
  resolvePricing,
  assertSubscriptionUpgrade,
} from "../services/pricing.js";
import { dbConnection } from "../config/db.js";

import {
  createPaidSubscriptionFromVerifiedPayment,
} from "../services/subscription.js";
import { handleControllerError } from "../utils/controllerError.js";
import AppError from "../utils/AppError.js";

const PAYSTACK_URL = "https://api.paystack.co";
const PAYMENT_CURRENCY = "NGN";
const MANAGER_ROLES = ["LEADER", "VICE_LEADER", "ADMINISTRATOR"];

const paystackHeaders = () => ({
  Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
  "Content-Type": "application/json",
});

const paymentMetadata = (
  pricing,
  schoolId,
  purpose = "INITIAL_ACTIVATION",
  previousSubscription = null
) => ({
  purpose,
  plan: pricing.plan,
  tierId: pricing.tierId,
  billingCycle: pricing.billingCycle,
  minStudents: pricing.minStudents,
  maxStudents: pricing.maxStudents,
  schoolId,

  ...(purpose === "SUBSCRIPTION_UPGRADE" && previousSubscription
    ? {
        previousSubscriptionId: previousSubscription.id,
        previousPlan: previousSubscription.plan,
        previousTierId: previousSubscription.tierId,
        previousBillingCycle: previousSubscription.billingCycle,
      }
    : {}),
});

const resolvePaymentMetadata = (metadata, schoolId) => {
  if (metadata?.schoolId !== schoolId) {
    throw new Error("Payment metadata does not match the payment school.");
  }

  const pricing = resolvePricing({
    plan: metadata?.plan,
    tierId: metadata?.tierId,
    billingCycle: metadata?.billingCycle,
  });

  if (
    metadata?.minStudents !== pricing.minStudents ||
    metadata?.maxStudents !== pricing.maxStudents
  ) {
    throw new Error("Payment metadata does not match configured pricing.");
  }

  return pricing;
};

const isDefiniteProviderFailure = (error) =>
  Boolean(error?.response && error.response.status >= 400);

export const initializePayment = async (req, res, next) => {
  let payment;

  try {
    const { email, plan, tierId, billingCycle } = req.body;
    const { schoolId } = req.params;

    if (
      !req.user ||
      req.user.schoolId !== schoolId ||
      !MANAGER_ROLES.includes(req.user.role)
    ) {
      throw new AppError(
        "You are not authorized to initialize payment for this school.",
        403
      );
    }

    const school = await School.findByPk(schoolId);

    if (!school) {
      throw new AppError("School not found.", 404);
    }

    if (school.status !== "PENDING_ACTIVATION") {
      throw new AppError(
        "This school is not eligible for initial paid activation.",
        409
      );
    }

    const existingSubscription = await SubscriptionPlan.findOne({
      where: { schoolId },
    });

    if (existingSubscription) {
      throw new AppError(
        "This school already has a subscription.",
        409
      );
    }

    let pricing;

    try {
      pricing = resolvePricing({ plan, tierId, billingCycle });
    } catch (error) {
      throw new AppError(error.message, 400);
    }

    if (pricing.plan === "FREE" || pricing.price <= 0) {
      throw new AppError(
        "FREE plans cannot be initialized through the payment endpoint.",
        400
      );
    }

    if (
      school.selectedPlan !== pricing.plan ||
      String(school.selectedTierId) !== String(pricing.tierId) ||
      school.selectedBillingCycle !== pricing.billingCycle
    ) {
      throw new AppError(
        "The requested payment selection does not match the school's saved registration selection.",
        409
      );
    }

    const activeAttempt = await Payment.findOne({
      where: {
        schoolId,
        status: { [Op.in]: ["PENDING", "PROCESSING"] },
      },
    });

    if (activeAttempt) {
      throw new AppError(
        "An active payment attempt already exists for this school.",
        409
      );
    }

    const reference = `SCH_PAY_${crypto.randomUUID()}`;
    const metadata = paymentMetadata(pricing, schoolId);

    payment = await Payment.create({
      schoolId,
      reference,
      amount: pricing.price,
      currency: PAYMENT_CURRENCY,
      status: "PENDING",
      provider: "PAYSTACK",
      metadata,
    });

    let paystackResponse;

    try {
      paystackResponse = await axios.post(
        `${PAYSTACK_URL}/transaction/initialize`,
        {
          email,
          amount: Math.round(Number(pricing.price) * 100),
          reference,
          metadata,
        },
        { headers: paystackHeaders() }
      );
    } catch (error) {
      // Only mark FAILED if the payment is still PENDING.
      // A webhook may already have processed it.
      if (isDefiniteProviderFailure(error)) {
        await Payment.update(
          { status: "FAILED" },
          {
            where: {
              id: payment.id,
              status: "PENDING",
            },
          }
        );
      }

      throw error;
    }

    // Only transition PENDING -> PROCESSING.
    // Never overwrite a status already changed by the webhook.
    await Payment.update(
      { status: "PROCESSING" },
      {
        where: {
          id: payment.id,
          status: "PENDING",
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Payment initialized successfully.",
      data: {
        paymentId: payment.id,
        reference,
        pricing,
        authorizationUrl:
          paystackResponse.data.data.authorization_url,
      },
    });
  } catch (error) {
    return handleControllerError(
      error,
      next,
      req,
      "INITIALIZE_PAYMENT_ERROR",
      "Unable to initialize payment."
    );
  }
};

const signaturesMatch = (rawBody, signature) => {
  if (!rawBody || typeof signature !== "string") return false;
  const expected = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(signature, "utf8");
  return (
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  );
};

export const handlePaystackWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-paystack-signature"];
    if (!signaturesMatch(req.body, signature)) {
      return res.status(401).json({
        success: false,
        message: "Invalid Paystack signature.",
      });
    }

    const event = JSON.parse(req.body.toString("utf8"));
    if (event.event !== "charge.success") {
      return res.status(200).json({ received: true });
    }

    const reference = event.data?.reference;
    if (!reference) {
      return res.status(400).json({ received: false });
    }

    const payment = await Payment.findOne({ where: { reference } });
    if (!payment) {
      return res.status(202).json({ received: true });
    }

    const verificationResponse = await axios.get(
      `${PAYSTACK_URL}/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: paystackHeaders() }
    );
    const verified = verificationResponse.data?.data;

    if (
      verified?.reference !== reference ||
      verified?.status !== "success" ||
      Number(verified?.amount) !== Math.round(Number(payment.amount) * 100) ||
      verified?.currency !== payment.currency
    ) {
      return res.status(400).json({
        received: false,
        message: "Paystack transaction verification failed.",
      });
    }

    const paidAt = new Date(verified.paid_at);
    if (Number.isNaN(paidAt.getTime())) {
      return res.status(400).json({
        received: false,
        message: "Verified payment date is invalid.",
      });
    }

    resolvePaymentMetadata(payment.metadata, payment.schoolId);

    const transaction = await dbConnection.transaction();
    try {
      const lockedPayment = await Payment.findOne({
        where: { id: payment.id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

if (!lockedPayment) {
  throw new Error("Payment no longer exists.");
}

// 1. Already processed successfully.
if (lockedPayment.status === "SUCCESSFUL") {
  await transaction.rollback();

  return res.status(200).json({
    received: true,
    message: "Payment already processed.",
  });
}

// 2. Payment previously failed or cancelled.
if (["FAILED", "CANCELLED"].includes(lockedPayment.status)) {
  await transaction.rollback();

  console.error(
    "PAYSTACK_LATE_SUCCESS_REQUIRES_RECONCILIATION:",
    reference
  );

  return res.status(202).json({
    received: true,
    message: "Payment requires reconciliation.",
  });
}

// 3. Only PENDING and PROCESSING payments can continue.
if (!["PENDING", "PROCESSING"].includes(lockedPayment.status)) {
  await transaction.rollback();

  return res.status(202).json({
    received: true,
    message: "Payment is not in a processable state.",
  });
}

// 4. Continue normal payment processing.
await lockedPayment.update(
  {
    status: "PROCESSING",
    providerTransactionId: String(verified.id),
    paidAt,
  },
  { transaction }
);

      await createPaidSubscriptionFromVerifiedPayment({
        payment: lockedPayment,
        transaction,
      });

      await lockedPayment.update(
        { status: "SUCCESSFUL" },
        { transaction }
      );
      await transaction.commit();

      return res.status(200).json({
        received: true,
        data: { reference, status: "SUCCESSFUL" },
      });
    } catch (error) {
      if (!transaction.finished) await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("PAYSTACK_WEBHOOK_ERROR:", {
      message: error.message,
      reference: req.body?.toString?.().slice(0, 200),
    });
    return res.status(500).json({ received: false });
  }
};

export const getPaymentStatus = async (req, res, next) => {
  try {
    const { reference } = req.params;
    const payment = await Payment.findOne({ where: { reference } });

    if (!payment) throw new AppError("Payment not found.", 404);
    if (
      !req.user ||
      req.user.schoolId !== payment.schoolId ||
      !MANAGER_ROLES.includes(req.user.role)
    ) {
      throw new AppError(
        "You are not authorized to access this payment.",
        403
      );
    }

    return res.status(200).json({
      success: true,
      data: {
        reference: payment.reference,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        paidAt: payment.paidAt,
      },
    });
  } catch (error) {
    return handleControllerError(
      error,
      next,
      req,
      "GET_PAYMENT_STATUS_ERROR",
      "Unable to get payment status."
    );
  }
};


export const getPaymentHistory = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;
    const { page = 1, limit = 10, status } = req.query;

    if (!schoolId) {
      throw new AppError("School information is missing.", 400);
    }

    const where = { schoolId };

    if (status) {
      where.status = status;
    }

    const pageNumber = Number(page);
    const pageSize = Number(limit);
    const offset = (pageNumber - 1) * pageSize;

    const { count, rows } = await Payment.findAndCountAll({
      where,
      attributes: [
        "id",
        "reference",
        "amount",
        "currency",
        "status",
        "provider",
        "paidAt",
        "createdAt",
        "metadata",
      ],
      order: [
        ["createdAt", "DESC"],
      ],
      limit: pageSize,
      offset,
    });

    const payments = rows.map((payment) => ({
      id: payment.id,
      reference: payment.reference,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      provider: payment.provider,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      plan: payment.metadata?.plan || null,
      tierId: payment.metadata?.tierId || null,
      billingCycle: payment.metadata?.billingCycle || null,
    }));

    return res.status(200).json({
      success: true,
      message: "Payment history retrieved successfully.",
      data: {
        payments,
        pagination: {
          totalItems: count,
          currentPage: pageNumber,
          pageSize,
          totalPages: Math.ceil(count / pageSize),
          hasNextPage: pageNumber * pageSize < count,
          hasPreviousPage: pageNumber > 1,
        },
      },
    });
  } catch (error) {
    return handleControllerError(
      error,
      next,
      req,
      "GET_PAYMENT_HISTORY_ERROR",
      "Unable to retrieve payment history."
    );
  }
};

export const getPaymentReceipt = async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    const schoolId = req.user?.schoolId;

    const payment = await Payment.findOne({
      where: {
        id: paymentId,
        schoolId,
      },
      attributes: [
        "id",
        "schoolId",
        "reference",
        "amount",
        "currency",
        "status",
        "provider",
        "providerTransactionId",
        "paidAt",
        "createdAt",
        "metadata",
      ],
    });

    if (!payment) {
      throw new AppError("Payment not found.", 404);
    }

    if (payment.status !== "SUCCESSFUL") {
      throw new AppError(
        "A receipt is only available for successful payments.",
        409
      );
    }

    return res.status(200).json({
      success: true,
      message: "Payment receipt retrieved successfully.",
      data: {
        receipt: {
          receiptNumber: payment.reference,
          paymentId: payment.id,
          schoolId: payment.schoolId,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          paymentMethod: payment.provider,
          transactionId: payment.providerTransactionId,
          paidAt: payment.paidAt,
          plan: payment.metadata?.plan || null,
          tierId: payment.metadata?.tierId || null,
          billingCycle: payment.metadata?.billingCycle || null,
        },
      },
    });
  } catch (error) {
    return handleControllerError(
      error,
      next,
      req,
      "GET_PAYMENT_RECEIPT_ERROR",
      "Unable to retrieve payment receipt."
    );
  }
};


export const initializeUpgradePayment = async (req, res, next) => {
  let payment;
  let transaction;

  try {
    const { email, plan, tierId, billingCycle, callback_url } = req.body;
    const { schoolId } = req.params;

    if (
      !req.user ||
      req.user.schoolId !== schoolId ||
      !MANAGER_ROLES.includes(req.user.role)
    ) {
      throw new AppError(
        "You are not authorized to upgrade this school's subscription.",
        403
      );
    }

    let pricing;

    try {
      pricing = resolvePricing({
        plan,
        tierId,
        billingCycle,
      });
    } catch (error) {
      throw new AppError(error.message, 400);
    }

    if (pricing.plan === "FREE" || Number(pricing.price) <= 0) {
      throw new AppError(
        "A paid plan must be selected for an upgrade.",
        400
      );
    }

    transaction = await dbConnection.transaction();

    const school = await School.findByPk(schoolId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!school) {
      throw new AppError("School not found.", 404);
    }

    if (school.status !== "ACTIVE") {
      throw new AppError(
        "Only active schools can upgrade their subscriptions.",
        409
      );
    }

    const currentSubscription = await SubscriptionPlan.findOne({
      where: { schoolId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!currentSubscription) {
      throw new AppError(
        "No existing subscription was found for this school.",
        404
      );
    }

    if (
      !["ACTIVE", "TRIAL"].includes(currentSubscription.status)
    ) {
      throw new AppError(
        "Your current subscription is not eligible for an upgrade.",
        409
      );
    }

    // Do not allow upgrades from an already expired subscription.
    const currentEndDate =
      currentSubscription.subscriptionEndsAt ||
      currentSubscription.trialEndsAt;

    if (
      currentEndDate &&
      new Date(currentEndDate).getTime() <= Date.now()
    ) {
      throw new AppError(
        "Your current subscription has expired. Please resolve its status before upgrading.",
        409
      );
    }

    try {
      assertSubscriptionUpgrade({
        currentSubscription,
        targetPricing: pricing,
      });
    } catch (error) {
      throw new AppError(error.message, 400);
    }

    // Verify the target capacity against actual active students.
    const activeStudents = await Student.count({
      where: {
        schoolId,
        admissionStatus: "ACTIVE",
      },
      transaction,
    });

    if (
      pricing.maxStudents !== null &&
      activeStudents > pricing.maxStudents
    ) {
      throw new AppError(
        `Your school currently has ${activeStudents} active students. Select a tier that accommodates this number.`,
        409
      );
    }

    // Prevent concurrent payment attempts for this school.
    const activeAttempt = await Payment.findOne({
      where: {
        schoolId,
        status: {
          [Op.in]: ["PENDING", "PROCESSING"],
        },
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (activeAttempt) {
      throw new AppError(
        "An active payment attempt already exists for this school. Please complete or resolve it before starting another payment.",
        409
      );
    }

    const reference = `SCH_PAY_${crypto.randomUUID()}`;

    const metadata = paymentMetadata(
      pricing,
      schoolId,
      "SUBSCRIPTION_UPGRADE",
      currentSubscription
    );

    payment = await Payment.create(
      {
        schoolId,
        reference,
        amount: pricing.price,
        currency: PAYMENT_CURRENCY,
        status: "PENDING",
        provider: "PAYSTACK",
        metadata,
      },
      { transaction }
    );

    await transaction.commit();
    transaction = null;

    let paystackResponse;

    try {
      paystackResponse = await axios.post(
        `${PAYSTACK_URL}/transaction/initialize`,
        {
          email,
          amount: Math.round(Number(pricing.price) * 100),
          reference,
          metadata,
          ...(callback_url ? { callback_url } : {}),
        },
        {
          headers: paystackHeaders(),
        }
      );
    } catch (error) {
      if (isDefiniteProviderFailure(error)) {
        await Payment.update(
          { status: "FAILED" },
          {
            where: {
              id: payment.id,
              status: "PENDING",
            },
          }
        );
      }

      throw error;
    }

    await Payment.update(
      { status: "PROCESSING" },
      {
        where: {
          id: payment.id,
          status: "PENDING",
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Subscription upgrade payment initialized successfully.",
      data: {
        paymentId: payment.id,
        reference,
        purpose: "SUBSCRIPTION_UPGRADE",
        pricing,
        authorizationUrl:
          paystackResponse.data.data.authorization_url,
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    return handleControllerError(
      error,
      next,
      req,
      "INITIALIZE_UPGRADE_PAYMENT_ERROR",
      "Unable to initialize subscription upgrade payment."
    );
  }
};