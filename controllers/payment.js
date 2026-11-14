import axios from "axios";
import crypto from "crypto";
import { Op } from "sequelize";
import {
  Payment,
  School,
  SubscriptionPlan,
  Student,
  Owner,
  User,
} from "../relationships/associations.js";
import verifyInitialPaymentToken from "../utils/verifyInitialPaymentToken.js";

import { resolvePricing } from "../services/pricing.js";
import { dbConnection } from "../config/db.js";

import {
  createPaidSubscriptionFromVerifiedPayment,
  assertPaidSubscriptionSelection,
} from "../services/subscription.js";
import { handleControllerError } from "../utils/controllerError.js";
import AppError from "../utils/AppError.js";

const PAYSTACK_URL = "https://api.paystack.co";
const PAYMENT_CURRENCY = "NGN";
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
    const { plan, tierId, billingCycle } = req.body;
    const { schoolId } = req.params;

    // 1. Extract and validate the temporary initial-payment token.
    const authorization = req.headers.authorization;

    if (
      typeof authorization !== "string" ||
      !authorization.startsWith("Bearer ")
    ) {
      throw new AppError(
        "Initial payment authorization token is required.",
        401
      );
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      throw new AppError(
        "Initial payment authorization token is required.",
        401
      );
    }

    const {
      userId,
      schoolId: authorizedSchoolId,
    } = verifyInitialPaymentToken(token);

    if (authorizedSchoolId !== schoolId) {
      throw new AppError(
        "You are not authorized to initialize payment for this school.",
        403
      );
    }

    // 2. Confirm that the school exists.
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

    // 3. Confirm that the token belongs to a verified user of this school.
    const user = await User.findOne({
      where: {
        id: userId,
        schoolId,
        isEmailVerified: true,
      },
    });

    if (!user) {
      throw new AppError(
        "The verified account associated with this payment session could not be found.",
        403
      );
    }

    // 4. Confirm that this user is the school's registered owner.
    const owner = await Owner.findOne({
      where: {
        userId,
        schoolId,
      },
    });

    if (!owner) {
      throw new AppError(
        "You are not authorized to make the initial payment for this school.",
        403
      );
    }

    // 5. Ensure the school has not already received a subscription.
    const existingSubscription = await SubscriptionPlan.findOne({
      where: { schoolId },
    });

    if (existingSubscription) {
      throw new AppError(
        "This school already has a subscription.",
        409
      );
    }

    // 6. Validate the requested pricing selection.
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

    // 7. Ensure the selection matches the school's saved registration details.
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

    // 8. Prevent duplicate active payment attempts.
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

    // 9. Create the payment record.
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

    // 10. Initialize payment with Paystack.
    let paystackResponse;

    try {
      paystackResponse = await axios.post(
        `${PAYSTACK_URL}/transaction/initialize`,
        {
          email: user.email,
          amount: Math.round(Number(pricing.price) * 100),
          reference,
          metadata,
        },
        { headers: paystackHeaders() }
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

    // 11. Transition PENDING -> PROCESSING.
    await Payment.update(
      { status: "PROCESSING" },
      {
        where: {
          id: payment.id,
          status: "PENDING",
        },
      }
    );

    // 12. Return payment details.
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
    if (req.user?.schoolId !== payment.schoolId) {
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
    const { plan, tierId, billingCycle } = req.body;
    const { schoolId } = req.params;

    // 1. Retrieve the authenticated user's email from the database.
    const user = await User.findByPk(req.user.id, {
      attributes: ["id", "email", "schoolId"],
    });

    if (
      !user ||
      user.schoolId !== schoolId ||
      !user.email
    ) {
      throw new AppError(
        "The authenticated user's email could not be verified.",
        403
      );
    }

    let pricing;

    // 3. Resolve and validate the requested pricing.
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

    // 4. Begin database transaction.
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

    // 5. Retrieve and lock the current subscription.
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

    // 7. Validate that the requested plan is a legitimate upgrade.
    try {
      assertPaidSubscriptionSelection({
        currentSubscription,
        targetPricing: pricing,
        at: new Date(),
      });
    } catch (error) {
      throw new AppError(error.message, 400);
    }

    // 8. Verify the target capacity against active students.
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

    // 9. Prevent concurrent payment attempts for this school.
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

    // 10. Generate payment reference and backend metadata.
    const reference = `SCH_PAY_${crypto.randomUUID()}`;

    const metadata = paymentMetadata(
      pricing,
      schoolId,
      "SUBSCRIPTION_UPGRADE",
      currentSubscription
    );

    // 11. Create payment record.
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

    // 12. Initialize payment with Paystack.
    let paystackResponse;

    try {
      paystackResponse = await axios.post(
        `${PAYSTACK_URL}/transaction/initialize`,
        {
          email: user.email,
          amount: Math.round(Number(pricing.price) * 100),
          reference,
          metadata,
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

    // 13. Transition payment from PENDING to PROCESSING.
    await Payment.update(
      { status: "PROCESSING" },
      {
        where: {
          id: payment.id,
          status: "PENDING",
        },
      }
    );

    // 14. Return payment details.
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