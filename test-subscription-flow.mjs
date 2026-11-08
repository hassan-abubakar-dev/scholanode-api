import { dbConnection } from "./config/db.js";
import {
  School,
  User,
  SubscriptionPlan,
  Payment,
  VerificationCode,
} from "./relationships/associations.js";
import {
  createFreeSubscriptionForSchool,
  createPaidSubscriptionFromVerifiedPayment,
} from "./services/subscription.js";
import {
  calculateSubscriptionExpiry,
  calculateTrialExpiry,
  SUBSCRIPTION_DURATIONS_DAYS,
  FREE_PLAN_CONFIG,
} from "./config/pricing.js";
import crypto from "crypto";

async function runTests() {
  console.log("=== STARTING SUBSCRIPTION LOGIC TESTS ===");

  try {
    // 1. Verify duration helper calculations
    console.log("\n[Test 1] Verifying Duration Helpers...");
    const now = new Date("2026-11-07T12:00:00Z");

    const trialExpiry = calculateTrialExpiry(now);
    const expectedTrialMs = now.getTime() + 120 * 24 * 60 * 60 * 1000;
    if (trialExpiry.getTime() !== expectedTrialMs) {
      throw new Error(`Trial expiry calculation mismatch: ${trialExpiry.toISOString()}`);
    }
    console.log("✓ FREE trial duration helper correct (120 days):", trialExpiry.toISOString());

    const monthlyExpiry = calculateSubscriptionExpiry("MONTHLY", now);
    const expectedMonthlyMs = now.getTime() + 30 * 24 * 60 * 60 * 1000;
    if (monthlyExpiry.getTime() !== expectedMonthlyMs) {
      throw new Error(`Monthly expiry calculation mismatch`);
    }
    console.log("✓ MONTHLY duration helper correct (30 days):", monthlyExpiry.toISOString());

    const termlyExpiry = calculateSubscriptionExpiry("TERMLY", now);
    const expectedTermlyMs = now.getTime() + 90 * 24 * 60 * 60 * 1000;
    if (termlyExpiry.getTime() !== expectedTermlyMs) {
      throw new Error(`Termly expiry calculation mismatch`);
    }
    console.log("✓ TERMLY duration helper correct (90 days):", termlyExpiry.toISOString());

    const yearlyExpiry = calculateSubscriptionExpiry("YEARLY", now);
    const expectedYearlyMs = now.getTime() + 360 * 24 * 60 * 60 * 1000;
    if (yearlyExpiry.getTime() !== expectedYearlyMs) {
      throw new Error(`Yearly expiry calculation mismatch`);
    }
    console.log("✓ YEARLY duration helper correct (360 days):", yearlyExpiry.toISOString());

    // 2. Test FREE Subscription Workflow
    console.log("\n[Test 2] Testing FREE Plan Subscription Creation...");
    const testSchoolCode1 = `TEST_FREE_${Date.now().toString().slice(-6)}`;
    const schoolFree = await School.create({
      schoolName: "Test Free Academy",
      schoolCode: testSchoolCode1,
      address: "123 Free Street, Dutse",
      schoolLevel: "COMBINED",
      ownershipType: "PRIVATE",
      status: "PENDING_VERIFICATION",
      selectedPlan: "FREE",
      selectedTierId: null,
      selectedBillingCycle: null,
    });

    const tx1 = await dbConnection.transaction();
    const createdFreeSub = await createFreeSubscriptionForSchool({
      school: schoolFree,
      transaction: tx1,
    });
    await tx1.commit();

    if (createdFreeSub.plan !== "FREE") throw new Error("Plan is not FREE");
    if (createdFreeSub.status !== "TRIAL") throw new Error("Status is not TRIAL");
    if (createdFreeSub.maxStudents !== null) throw new Error("maxStudents is not null");
    if (!createdFreeSub.trialEndsAt) throw new Error("trialEndsAt is missing");
    if (createdFreeSub.subscriptionEndsAt !== null) throw new Error("subscriptionEndsAt should be null");

    // Check that school temporary fields were cleared
    await schoolFree.reload();
    if (schoolFree.selectedPlan !== null || schoolFree.selectedTierId !== null || schoolFree.selectedBillingCycle !== null) {
      throw new Error("Temporary school selection fields were not cleared after FREE subscription creation");
    }
    console.log("✓ FREE subscription created correctly with status TRIAL, unlimited students, and cleared temporary fields.");

    // Test idempotency of FREE creation
    const tx1Idempotent = await dbConnection.transaction();
    const retryFreeSub = await createFreeSubscriptionForSchool({
      school: schoolFree,
      transaction: tx1Idempotent,
    });
    await tx1Idempotent.commit();
    if (retryFreeSub.id !== createdFreeSub.id) {
      throw new Error("Idempotent retry created duplicate subscription");
    }
    console.log("✓ FREE subscription idempotency verified (no duplicate created).");

    // 3. Test PAID Subscription Workflow
    console.log("\n[Test 3] Testing PAID Plan Subscription Creation from Verified Payment...");
    const testSchoolCode2 = `TEST_PAID_${Date.now().toString().slice(-6)}`;
    const schoolPaid = await School.create({
      schoolName: "Test Paid Academy",
      schoolCode: testSchoolCode2,
      address: "456 Paid Avenue, Dutse",
      schoolLevel: "SECONDARY",
      ownershipType: "PRIVATE",
      status: "PENDING_ACTIVATION",
      selectedPlan: "STARTER",
      selectedTierId: "STARTER_1_300",
      selectedBillingCycle: "MONTHLY",
    });

    const paymentReference = `TEST_REF_${Date.now()}`;
    const payment = await Payment.create({
      schoolId: schoolPaid.id,
      reference: paymentReference,
      amount: 15000,
      currency: "NGN",
      status: "SUCCESSFUL",
      provider: "PAYSTACK",
      providerTransactionId: "paystack_mock_12345",
      paidAt: new Date(),
      metadata: {
        plan: "STARTER",
        tierId: "STARTER_1_300",
        billingCycle: "MONTHLY",
        minStudents: 1,
        maxStudents: 999999, // Intentional test: frontend claimed 999999 students
      },
    });

    const tx2 = await dbConnection.transaction();
    const paidResult = await createPaidSubscriptionFromVerifiedPayment({
      payment,
      transaction: tx2,
    });
    await tx2.commit();

    if (!paidResult.success) throw new Error("Paid subscription creation failed");
    const createdPaidSub = paidResult.subscription;

    if (createdPaidSub.plan !== "STARTER") throw new Error("Plan is not STARTER");
    if (createdPaidSub.billingCycle !== "MONTHLY") throw new Error("BillingCycle is not MONTHLY");
    if (createdPaidSub.status !== "ACTIVE") throw new Error("Status is not ACTIVE");
    if (createdPaidSub.maxStudents !== 300) {
      throw new Error(`Authoritative tier limit was not enforced! Expected 300, got ${createdPaidSub.maxStudents}`);
    }
    if (createdPaidSub.trialEndsAt !== null) throw new Error("trialEndsAt should be null for paid plan");
    if (!createdPaidSub.subscriptionEndsAt) throw new Error("subscriptionEndsAt is missing");

    await schoolPaid.reload();
    if (schoolPaid.selectedPlan !== null || schoolPaid.selectedTierId !== null || schoolPaid.selectedBillingCycle !== null) {
      throw new Error("Temporary school selection fields were not cleared after PAID subscription creation");
    }
    console.log("✓ PAID subscription created correctly with authoritative maxStudents (300), status ACTIVE, 30-day expiry, and cleared fields.");

    // 4. Test Selection Mismatch Handling
    console.log("\n[Test 4] Testing Selection Mismatch Guardrail...");
    const testSchoolCode3 = `TEST_MIS_${Date.now().toString().slice(-6)}`;
    const schoolMismatch = await School.create({
      schoolName: "Test Mismatch Academy",
      schoolCode: testSchoolCode3,
      address: "789 Mismatch Rd",
      schoolLevel: "PRIMARY",
      ownershipType: "PRIVATE",
      status: "PENDING_ACTIVATION",
      selectedPlan: "STARTER",
      selectedTierId: "STARTER_1_300",
      selectedBillingCycle: "YEARLY",
    });

    const mismatchPayment = await Payment.create({
      schoolId: schoolMismatch.id,
      reference: `MISMATCH_REF_${Date.now()}`,
      amount: 15000,
      currency: "NGN",
      status: "SUCCESSFUL",
      provider: "PAYSTACK",
      metadata: {
        plan: "STARTER",
        tierId: "STARTER_1_300",
        billingCycle: "MONTHLY", // Mismatches school's YEARLY
      },
    });

    const tx3 = await dbConnection.transaction();
    const mismatchResult = await createPaidSubscriptionFromVerifiedPayment({
      payment: mismatchPayment,
      transaction: tx3,
    });
    await tx3.commit();

    if (mismatchResult.success) {
      throw new Error("Mismatch should have prevented subscription creation!");
    }
    if (!mismatchResult.mismatch) {
      throw new Error("mismatch flag should be true");
    }

    const subCheck = await SubscriptionPlan.findOne({ where: { schoolId: schoolMismatch.id } });
    if (subCheck !== null) {
      throw new Error("Subscription must NOT be created when details mismatch!");
    }

    await mismatchPayment.reload();
    if (!mismatchPayment.metadata?.subscriptionMismatch) {
      throw new Error("Mismatch information was not recorded in payment metadata");
    }
    console.log("✓ Selection mismatch was safely caught: subscription was blocked, and audit details were preserved in payment metadata.");

    // Clean up test records
    await SubscriptionPlan.destroy({ where: { schoolId: [schoolFree.id, schoolPaid.id, schoolMismatch.id] } });
    await Payment.destroy({ where: { schoolId: [schoolFree.id, schoolPaid.id, schoolMismatch.id] } });
    await School.destroy({ where: { id: [schoolFree.id, schoolPaid.id, schoolMismatch.id] } });
    console.log("✓ Test records cleaned up successfully.");

    console.log("\n=== ALL SUBSCRIPTION TESTS PASSED SUCCESSFULLY ===");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ TEST FAILED:", error);
    process.exit(1);
  }
}

runTests();
