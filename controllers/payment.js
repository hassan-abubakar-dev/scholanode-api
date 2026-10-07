import axios from "axios";
import crypto from "crypto";
import Payment from "../models/Payment.js";
import School from "../models/School.js";
import { resolvePricing } from "../services/pricing.js";

// ========================================
// INITIALIZE PAYMENT
// ========================================

export const initializePayment = async (req, res) => {
  let payment;

  try {
    const {
      email,
      plan,
      tierId,
      billingCycle,
      metadata,
    } = req.body;
    const { schoolId } = req.params;

    // ========================================
    // VALIDATE REQUIRED FIELDS
    // ========================================

    if (!schoolId || !email || !plan || !tierId || !billingCycle) {
      return res.status(400).json({
        success: false,
        message:
          "School ID in the URL, email, plan, tierId, and billingCycle are required.",
      });
    }

    if (req.user?.schoolId && req.user.schoolId !== schoolId) {
      return res.status(403).json({
        success: false,
        message: "You cannot initialize payment for another school.",
      });
    }

    // ========================================
    // RESOLVE PRICING
    // ========================================

    let pricing;

    try {
      pricing = resolvePricing({
        plan,
        tierId,
        billingCycle,
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    const amount = pricing.price;

    const paymentMetadata = {
      ...metadata,
      plan: pricing.plan,
      tierId: pricing.tierId,
      billingCycle: pricing.billingCycle,
      minStudents: pricing.minStudents,
      maxStudents: pricing.maxStudents,
    };

    // ========================================
    // CHECK IF SCHOOL EXISTS
    // ========================================

    const school = await School.findByPk(schoolId);

    if (!school) {
      return res.status(404).json({
        success: false,
        message: "School not found.",
      });
    }

    // ========================================
    // GENERATE UNIQUE PAYMENT REFERENCE
    // ========================================

    const reference = `SCH_PAY_${crypto.randomUUID()}`;

    // ========================================
    // CREATE PAYMENT RECORD
    // ========================================

    payment = await Payment.create({
      schoolId,
      reference,
      amount,
      currency: "NGN",
      status: "PENDING",
      provider: "PAYSTACK",
      metadata: paymentMetadata,
    });

    // ========================================
    // INITIALIZE PAYSTACK PAYMENT
    // ========================================

    const paystackResponse = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount: Math.round(Number(amount) * 100),
        reference,

        metadata: {
          ...paymentMetadata,
          schoolId,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    // ========================================
    // UPDATE PAYMENT STATUS
    // ========================================

    await payment.update({
      status: "PROCESSING",
    });

    // ========================================
    // RETURN PAYMENT URL
    // ========================================

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
    console.error(
      "Initialize payment error:",
      error.response?.data || error.message
    );

    // ========================================
    // MARK PAYMENT AS FAILED
    // ========================================

    if (payment) {
      await payment.update({
        status: "FAILED",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to initialize payment.",
    });
  }
};


// ========================================
// PAYSTACK WEBHOOK
// ========================================

export const handlePaystackWebhook = async (req, res) => {
  try {
    // req.body must be the raw request body (Buffer)
    const signature = req.headers["x-paystack-signature"];

    if (!signature) {
      return res.status(401).json({
        success: false,
        message: "Missing Paystack signature.",
      });
    }

    // ========================================
    // VERIFY WEBHOOK SIGNATURE
    // ========================================

    const hash = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
      .update(req.body)
      .digest("hex");

    if (hash !== signature) {
      return res.status(401).json({
        success: false,
        message: "Invalid Paystack signature.",
      });
    }

    // Convert raw body to JSON
    const event = JSON.parse(req.body.toString());

    // We only care about successful charges
    if (event.event !== "charge.success") {
      return res.status(200).json({
        received: true,
      });
    }

    const transaction = event.data;
    const reference = transaction.reference;

    // ========================================
    // FIND LOCAL PAYMENT
    // ========================================

    const payment = await Payment.findOne({
      where: { reference },
    });

    if (!payment) {
      console.error(
        `PAYMENT_NOT_FOUND: ${reference}`
      );

      // Acknowledge webhook so Paystack does not
      // keep retrying an unknown payment.
      return res.status(200).json({
        received: true,
      });
    }

    // ========================================
    // IDEMPOTENCY CHECK
    // ========================================

    if (payment.status === "SUCCESSFUL") {
      return res.status(200).json({
        received: true,
        message: "Payment already processed.",
      });
    }

    // ========================================
    // VERIFY TRANSACTION WITH PAYSTACK
    // ========================================

    const verificationResponse = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const verifiedTransaction =
      verificationResponse.data.data;

    // ========================================
    // VERIFY PAYMENT STATUS
    // ========================================

    if (verifiedTransaction.status !== "success") {
      console.error(
        `PAYMENT_VERIFICATION_FAILED: ${reference}`
      );

      return res.status(200).json({
        received: true,
      });
    }

    // ========================================
    // VERIFY AMOUNT
    // ========================================

    const expectedAmount = Math.round(
      Number(payment.amount) * 100
    );

    if (verifiedTransaction.amount !== expectedAmount) {
      console.error("PAYMENT_AMOUNT_MISMATCH:", {
        reference,
        expected: expectedAmount,
        received: verifiedTransaction.amount,
      });

      return res.status(200).json({
        received: true,
      });
    }

    // ========================================
    // VERIFY CURRENCY
    // ========================================

    if (
      verifiedTransaction.currency !== payment.currency
    ) {
      console.error("PAYMENT_CURRENCY_MISMATCH:", {
        reference,
        expected: payment.currency,
        received: verifiedTransaction.currency,
      });

      return res.status(200).json({
        received: true,
      });
    }

    // ========================================
    // MARK PAYMENT SUCCESSFUL
    // ========================================

    await payment.update({
      status: "SUCCESSFUL",
      providerTransactionId:
        String(verifiedTransaction.id),
      paidAt: verifiedTransaction.paid_at
        ? new Date(verifiedTransaction.paid_at)
        : new Date(),
    });

    console.log(
      `PAYMENT_SUCCESSFUL: ${reference}`
    );

    // ========================================
    // CREATE SUBSCRIPTION HERE
    // ========================================
    //
    // await createSubscriptionFromPayment(payment);
    //
    // We will handle this separately.

    return res.status(200).json({
      received: true,
    });
  } catch (error) {
    console.error(
      "PAYSTACK_WEBHOOK_ERROR:",
      error.response?.data || error.message
    );

    return res.status(500).json({
      received: false,
    });
  }
};

// ========================================
// GET PAYMENT STATUS
// ========================================

// ========================================
// GET PAYMENT STATUS
// ======================================== 

export const getPaymentStatus = async (req, res) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: "Payment reference is required.",
      });
    }

    const payment = await Payment.findOne({
      where: { reference },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found.",
      });
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
    console.error(
      "Get payment status error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Unable to get payment status.",
    });
  }
};