import User from "../models/User.js";
import VerificationCode from "../models/VerificationCode.js";
import School from "../models/School.js";

import AppError from "../utils/AppError.js";
import generateToken from "../utils/token.js";
import { dbConnection } from "../config/db.js";

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
    const expiryTimestamp = Number(expiryTime);

    if (!Number.isFinite(expiryTimestamp)) {
        return true;
    }

    return Date.now() > expiryTimestamp;
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

        // 8. Consume only the code that was verified.
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