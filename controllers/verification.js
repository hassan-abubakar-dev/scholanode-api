import User from "../models/User.js";
import VerificationCode from "../models/VerificationCode.js";
import AppError from "../utils/AppError.js";
import dotenv from 'dotenv';
import {dbConnection} from "../config/db.js";
import School from "../models/School.js";

import generateToken from "../utils/token.js";
dotenv.config();

const isDev = process.env.NODE_ENV === 'development';

export const verifyNewSchoolAccount = async (req, res, next) => {
  const transaction = await dbConnection.transaction();

  try {
    const { email, code } = req.body;
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim();

    // 1. Find and lock the verification code
    const existingCode = await VerificationCode.findOne({
      where: {
        userEmail: normalizedEmail,
        code: code.trim(),
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

    // 2. Check whether the associated user exists
    const user = await User.findOne({
      where: { email: normalizedEmail },
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

    // 3. Check whether the code has expired
    if (
      Date.now() >
      new Date(existingCode.expiryTime).getTime()
    ) {
      await existingCode.destroy({ transaction });
      await transaction.commit();

      return next(
        new AppError(
          "Your verification code has expired. Please request a new one.",
          400
        )
      );
    }

    // 4. Find the school associated with the user
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

    // 5. Confirm this registration is awaiting verification
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

    // 6. Mark the user's email as verified
    user.isEmailVerified = true;
    await user.save({ transaction });

    // 7. Move the school to the next lifecycle stage
    school.status = "PENDING_ACTIVATION";
    school.isActive = false;
    await school.save({ transaction });

    // 8. Consume the verification code
    await existingCode.destroy({ transaction });

    // 9. Commit all changes together
    await transaction.commit();

    // 10. Return success only
    return res.status(200).json({
      status: "success",
      message: "Email verified successfully.",
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    console.error(
      "VERIFY_NEW_SCHOOL_ACCOUNT_ERROR:",
      {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        error,
      }
    );

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

export const verifyRecoveryCode = async (req, res, next) => {
  const transaction = await dbConnection.transaction();

  try {
    const { verificationCode, email } = req.body;
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = verificationCode.trim();

    // =========================================================
    // 3. FIND RECOVERY CODE
    // =========================================================
    //
    // Lock the row so two simultaneous requests cannot safely
    // consume the same recovery code.
    // =========================================================

    const recoveryCode = await VerificationCode.findOne({
      where: {
        code: normalizedCode,
        userEmail: normalizedEmail,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    // =========================================================
    // 4. INVALID CODE
    // =========================================================

    if (!recoveryCode) {
      await transaction.rollback();

      return next(
        new AppError(
          "The verification code or email address is incorrect. Please double-check your details and try again.",
          400
        )
      );
    }

    // =========================================================
    // 5. CHECK CODE EXPIRATION
    // =========================================================

    if (
      Date.now() >
      new Date(recoveryCode.expiryTime).getTime()
    ) {
      await VerificationCode.destroy({
        where: {
          code: normalizedCode,
          userEmail: normalizedEmail,
        },
        transaction,
      });

      await transaction.commit();

      return next(
        new AppError(
          "Your verification code has expired. Please request a new one.",
          400
        )
      );
    }

    // =========================================================
    // 6. FIND ACTIVE USER
    // =========================================================

    const user = await User.findOne({
      where: {
        email: normalizedEmail,
        status: "ACTIVE",
      },
      transaction,
    });

    // =========================================================
    // 7. USER DOES NOT EXIST / IS NOT ACTIVE
    // =========================================================

    if (!user) {
      await transaction.rollback();

      return next(
        new AppError(
          "We could not find an active account associated with these details. Please verify your email address.",
          404
        )
      );
    }

    // =========================================================
    // 8. CONSUME RECOVERY CODE
    // =========================================================
    //
    // The code becomes unusable immediately after successful
    // verification. This prevents replay.
    // =========================================================

    await VerificationCode.destroy({
      where: {
        code: normalizedCode,
        userEmail: normalizedEmail,
      },
      transaction,
    });

    // =========================================================
    // 9. COMMIT CODE CONSUMPTION
    // =========================================================

    await transaction.commit();

    // =========================================================
    // 10. GENERATE PASSWORD RESET TOKEN
    // =========================================================

    const resetPayload = {
      id: user.id,
      email: user.email, 
      purpose: "password_reset",
    };

    console.log("resetPayload", resetPayload);

    const passwordResetToken = generateToken(
      resetPayload,
      process.env.PASSWORD_RESET_TOKEN_KEY,
      process.env.PASSWORD_RESET_TOKEN_EXPIRY
    );

    // =========================================================
    // 11. RETURN RESET TOKEN
    // =========================================================

    return res.status(200).json({
      status: "success",
      message:
        "Verification code validated successfully. You may now proceed to reset your password.",
      email: user.email,
      resetToken: passwordResetToken,
    });

  } catch (error) {
    // =========================================================
    // UNEXPECTED ERROR
    // =========================================================

    if (
      transaction &&
      !transaction.finished
    ) {
      await transaction.rollback();
    }

    console.error("VERIFY_RECOVERY_CODE_ERROR:", {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      email: req.body?.email,
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