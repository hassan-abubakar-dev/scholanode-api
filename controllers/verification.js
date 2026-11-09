import { User, VerificationCode, School } from "../relationships/associations.js";
import AppError from "../utils/AppError.js";
import generateToken from "../utils/token.js";
import { dbConnection } from "../config/db.js";
import { createFreeSubscriptionForSchool } from "../services/subscription.js";
import pricingConfig from "../config/pricing.js";
import { resolvePricing } from "../services/pricing.js";
import issueVerificationCode from "../services/verificationCode.js";

import dotenv from "dotenv";

dotenv.config();

const isDev = process.env.NODE_ENV === "development";

const VERIFICATION_PURPOSES = Object.freeze({
    SCHOOL_REGISTRATION: "SCHOOL_REGISTRATION",
    PASSWORD_RESET: "PASSWORD_RESET",
});

/**
 * Normalize email addresses consistently.
 */
const normalizeEmail = (email) => email.trim().toLowerCase();

/**
 * Check whether a verification code has expired.
 *
 * Supports the existing expiryTime representation:
 * a Unix timestamp in milliseconds, or a date value
 * that JavaScript can parse.
 */
const isCodeExpired = (expiryTime) => {
    const expiryTimestamp =
        expiryTime instanceof Date ? expiryTime.getTime() : Number(expiryTime);

    if (!Number.isFinite(expiryTimestamp)) {
        const parsed = Date.parse(expiryTime);
        if (!Number.isFinite(parsed)) {
            return true;
        }
        return Date.now() > parsed;
    }

    return Date.now() > expiryTimestamp;
};

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });

const passwordResetResponse = {
  status: "success",
  message:
    "If an account matches that email address, password recovery instructions have been sent to it.",
};

/**
 * Verify a newly registered school's email address.
 *
 * Expected body:
 * {
 *   "email": "school@example.com",
 *   "code": "123456"
 * }
 */
export const verifyNewSchoolAccount = async (req, res, next) => {
    let transaction;

    try {
        const { email, code } = req.body;

        if (
            typeof email !== "string" ||
            typeof code !== "string" ||
            !email.trim() ||
            !/^\d{6}$/.test(code.trim())
        ) {
            return next(
                new AppError(
                    "Please provide a valid email address and six-digit verification code.",
                    400
                )
            );
        }

        const normalizedEmail = normalizeEmail(email);
        const normalizedCode = code.trim();

        transaction = await dbConnection.transaction();

        // 1. Find and lock the school-registration code.
        const existingCode = await VerificationCode.findOne({
            where: {
                userEmail: normalizedEmail,
                code: normalizedCode,
                purpose: VERIFICATION_PURPOSES.SCHOOL_REGISTRATION,
            },
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!existingCode) {
            await transaction.rollback();

            return next(
                new AppError(
                    "The email or verification code is invalid. Please check and try again.",
                    400
                )
            );
        }

        // 2. Find and lock the associated user.
        const user = await User.findOne({
            where: {
                email: normalizedEmail,
            },
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!user) {
            await transaction.rollback();

            return next(
                new AppError(
                    "The account associated with this email no longer exists.",
                    404
                )
            );
        }

        // 3. Check expiration.
        if (isCodeExpired(existingCode.expiryTime)) {
            await existingCode.destroy({ transaction });
            await transaction.commit();

            return next(
                new AppError(
                    "Your verification code has expired. Please request a new one.",
                    400
                )
            );
        }

        // 4. Find and lock the associated school.
        const school = await School.findByPk(user.schoolId, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!school) {
            await transaction.rollback();

            return next(
                new AppError(
                    "The school associated with this account no longer exists.",
                    404
                )
            );
        }

        // 5. Ensure registration is still awaiting verification.
        if (
            user.isEmailVerified ||
            school.status !== "PENDING_VERIFICATION"
        ) {
            await transaction.rollback();

            return next(
                new AppError(
                    "This account has already been verified or is no longer awaiting verification.",
                    400
                )
            );
        }

        // 6. Mark the user's email as verified.
        user.isEmailVerified = true;
        await user.save({ transaction });

        // 7. Move the school to the next lifecycle stage.
        school.status = "PENDING_ACTIVATION";
        school.isActive = false;
        await school.save({ transaction });

        // 8. Validate the saved selection before completing verification.
        let selectedPricing;
        try {
            selectedPricing = resolvePricing({
                plan: school.selectedPlan,
                tierId: school.selectedTierId,
                billingCycle: school.selectedBillingCycle,
            });
        } catch {
            throw new AppError(
                "The school's saved subscription selection is invalid. Please register again.",
                400
            );
        }

        if (selectedPricing.plan === pricingConfig.FREE.plan) {
            await createFreeSubscriptionForSchool({
                school,
                transaction,
                verifiedAt: new Date(),
            });
        }

        // 9. Consume only the code that was verified.
        await existingCode.destroy({ transaction });

        // 9. Commit all changes together.
        await transaction.commit();

        return res.status(200).json({
            status: "success",
            message: "Email verified successfully.",
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        if (error instanceof AppError) {
            return next(error);
        }

        console.error("VERIFY_NEW_SCHOOL_ACCOUNT_ERROR:", {
            url: req.originalUrl,
            method: req.method,
            ip: req.ip,
            error,
        });

        return next(
            new AppError(
                isDev
                    ? error.message
                    : "Failed to verify email. Please try again.",
                500
            )
        );
    }
};

/**
 * Verify a password-recovery code.
 *
 * Expected body:
 * {
 *   "email": "user@example.com",
 *   "verificationCode": "123456"
 * }
 *
 * On success, returns a password-reset token.
 */
export const verifyRecoveryCode = async (req, res, next) => {
    let transaction;

    try {
        const { verificationCode, email } = req.body;

        if (
            typeof email !== "string" ||
            typeof verificationCode !== "string" ||
            !email.trim() ||
            !/^\d{6}$/.test(verificationCode.trim())
        ) {
            return next(
                new AppError(
                    "Please provide a valid email address and six-digit verification code.",
                    400
                )
            );
        }

        const normalizedEmail = normalizeEmail(email);
        const normalizedCode = verificationCode.trim();

        transaction = await dbConnection.transaction();

        // 1. Find and lock only a password-reset code.
        const recoveryCode = await VerificationCode.findOne({
            where: {
                code: normalizedCode,
                userEmail: normalizedEmail,
                purpose: VERIFICATION_PURPOSES.PASSWORD_RESET,
            },
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!recoveryCode) {
            await transaction.rollback();

            return next(
                new AppError(
                    "The verification code or email address is incorrect. Please double-check your details and try again.",
                    400
                )
            );
        }

        // 2. Remove expired codes without affecting other purposes.
        if (isCodeExpired(recoveryCode.expiryTime)) {
            await recoveryCode.destroy({ transaction });
            await transaction.commit();

            return next(
                new AppError(
                    "Your verification code has expired. Please request a new one.",
                    400
                )
            );
        }

        // 3. Find the active user.
        const user = await User.findOne({
            where: {
                email: normalizedEmail,
                status: "ACTIVE",
            },
            transaction,
        });

        if (!user) {
            await transaction.rollback();

            return next(
                new AppError(
                    "We could not find an active account associated with these details. Please verify your email address.",
                    404
                )
            );
        }

        // 4. Consume this exact recovery code.
        await recoveryCode.destroy({ transaction });

        // 5. Commit code consumption before issuing the token.
        await transaction.commit();

        // 6. Generate the password-reset token.
        const resetPayload = {
            id: user.id,
            email: user.email,
            purpose: "password_reset",
        };

        const passwordResetToken = generateToken(
            resetPayload,
            process.env.PASSWORD_RESET_TOKEN_KEY,
            process.env.PASSWORD_RESET_TOKEN_EXPIRY
        );

        // 7. Return the existing response structure.
        return res.status(200).json({
            status: "success",
            message:
                "Verification code validated successfully. You may now proceed to reset your password.",
            email: user.email,
            resetToken: passwordResetToken,
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        if (error instanceof AppError) {
            return next(error);
        }

        console.error("VERIFY_RECOVERY_CODE_ERROR:", {
            url: req.originalUrl,
            method: req.method,
            ip: req.ip,
            email:
                typeof req.body?.email === "string"
                    ? req.body.email
                    : undefined,
            error,
        });

        return next(
            new AppError(
                isDev
                    ? error.message
                    : "Unable to verify the recovery code. Please try again.",
                500
            )
        );
    }
};


export const resendSchoolRegistrationCode = async (req, res, next) => {
  try {
    const email = req.body.email.trim().toLowerCase();

    const user = await User.findOne({
      where: { email },
    });

    // Do not disclose whether an email belongs to an account.
    if (!user || user.isEmailVerified) {
      return res.status(200).json({
        status: "success",
        message:
          "If an eligible registration matches that email address, a verification code will be sent.",
      });
    }

    const school = await School.findByPk(user.schoolId);

    if (!school || school.status !== "PENDING_VERIFICATION") {
      return res.status(200).json({
        status: "success",
        message:
          "If an eligible registration matches that email address, a verification code will be sent.",
      });
    }

    const result = await issueVerificationCode({
      userId: user.id,
      email,
      purpose: "SCHOOL_REGISTRATION",
      subject: "Verify your ScholaNode school account",

      buildEmail: (code) => `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; color: #333;">
          <h2 style="color: #071A52;">ScholaNode Email Verification</h2>

          <p>Hello ${escapeHtml(user.firstName)},</p>

          <p>
            Here is your new verification code for
            <strong>${escapeHtml(school.schoolName)}</strong>.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #071A52;">
              ${code}
            </span>
          </div>

          <p>
            This verification code will expire in 10 minutes.
          </p>

          <p>
            Your Login ID: <strong>${escapeHtml(user.loginId)}</strong>
          </p>

          <p>If you did not request this code, you can ignore this email.</p>

          <p>Best regards,<br>The ScholaNode Team</p>
        </div>
      `,
    });

    if (result.cooldown) {
      return res.status(429).json({
        status: "error",
        message: `Please wait ${result.remainingSeconds} seconds before requesting another code.`,
      });
    }

    return res.status(200).json({
      status: "success",
      message: "A new verification code has been sent to your email address.",
    });
  } catch (error) {
    console.error("RESEND_REGISTRATION_CODE_ERROR:", error);
    return next(
      new AppError("Unable to resend the verification code. Please try again.", 500)
    );
  }
};

export const resendPasswordResetCode = async (req, res, next) => {
  const email = req.body.email.trim().toLowerCase();

  try {
    const user = await User.findOne({
      where: {
        email,
        status: "ACTIVE",
      },
    });

    if (!user) {
      return res.status(200).json(passwordResetResponse);
    }

    const result = await issueVerificationCode({
      userId: user.id,
      email,
      purpose: "PASSWORD_RESET",
      subject: "Reset your ScholaNode password",

      buildEmail: (code) => `
        <div style="
          font-family: Arial, sans-serif;
          max-width: 600px;
          margin: 0 auto;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          overflow: hidden;
          background-color: #ffffff;
        ">
          <div style="background-color: #071A52; padding: 20px; text-align: center;">
            <h2 style="color: #ffffff; margin: 0;">
              ScholaNode Account Recovery
            </h2>
          </div>

          <div style="padding: 30px; color: #333333;">
            <p>Hello ${escapeHtml(user.firstName)},</p>

            <p>
              You requested a new password-reset verification code.
              Use the code below to continue:
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <span style="
                font-size: 32px;
                font-weight: bold;
                color: #071A52;
                background-color: #eef2ff;
                padding: 15px 30px;
                border-radius: 5px;
                letter-spacing: 5px;
              ">
                ${code}
              </span>
            </div>

            <p>
              <strong>Security Note:</strong>
              This verification code will expire in 10 minutes.
              If you did not request a password reset, you can safely
              ignore this email.
            </p>

            <p>Best regards,<br>The ScholaNode Security Team</p>
          </div>
        </div>
      `,
    });

    // Keep the response generic, including during the cooldown.
    if (result.cooldown || !result.sent) {
      return res.status(200).json(passwordResetResponse);
    }

    return res.status(200).json(passwordResetResponse);
  } catch (error) {
    console.error("RESEND_PASSWORD_RESET_CODE_ERROR:", {
      email,
      error,
    });

    // Do not reveal whether email delivery or account lookup failed.
    return res.status(200).json(passwordResetResponse);
  }
};