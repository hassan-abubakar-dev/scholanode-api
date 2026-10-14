/**
 * @file controllers/auths.js
 * @description Controller for authentication-related operations.
 */


import jwt from 'jsonwebtoken';
import bcrypt from "bcryptjs";
import dotenv from 'dotenv';
import AppError from '../utils/AppError.js';
import sendEmail from '../config/emailService.js';

import { dbConnection } from '../config/db.js';
 
import generateToken from '../utils/token.js';
import generateVerificationCode from '../utils/verificationCode.js';
import generateExpiryTime from '../utils/experyTime.js';

import { User, School, Owner, Student } from "../relationships/associations.js";
import VerificationCode from '../models/VerificationCode.js';


dotenv.config();

const isDev = process.env.NODE_ENV === 'development';

export const loginUser = async (req, res, next) => {
  try {
    const { schoolCode, loginId, password } = req.body;
    const normalizedSchoolCode = schoolCode.trim().toUpperCase();
    const normalizedLoginId = loginId.trim().toUpperCase();

    // 2. Find the school
    const school = await School.findOne({
      where: {
        schoolCode: normalizedSchoolCode,
      },
    });

    if (!school) {
      return next(
        new AppError(
          "Invalid school code or login credentials.",
          401
        )
      );
    }

    // 3. Allow active and pending-activation schools
    if (!["ACTIVE", "PENDING_ACTIVATION"].includes(school.status)) {
      return next(
        new AppError(
          "This school is not currently available. Please contact your school administrator.",
          403
        )
      );
    }

    // 4. Find the user within this school
    const user = await User.findOne({
      where: {
        loginId: normalizedLoginId,
        schoolId: school.id,
      },
    });

    if (!user) {
      return next(
        new AppError(
          "Invalid school code or login credentials.",
          401
        )
      );
    }

    // 5. Check user account status
    if (user.status !== "ACTIVE") {
      return next(
        new AppError(
          "Your account is not active. Please contact your school administrator.",
          403
        )
      );
    }

    // 6. Verify password
    const isPasswordValid = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!isPasswordValid) {
      return next(
        new AppError(
          "Invalid school code or login credentials.",
          401
        )
      );
    }

    // 7. Check ownership only for non-student users
    let isOwner = false;

    if (user.role !== "STUDENT") {
      const owner = await Owner.findOne({
        where: {
          schoolId: school.id,
          userId: user.id,
        },
      });

      isOwner = Boolean(owner);
    }

    // 8. Create access token payload
    const payload = {
      id: user.id,
      schoolId: school.id,
      loginId: user.loginId,
      role: user.role,
    };

    // 9. Generate access token
    const accessToken = generateToken(
      payload,
      process.env.ACCESS_TOKEN_KEY,
      process.env.ACCESS_TOKEN_EXPIRY
    );

    // 10. Generate refresh token
    const refreshToken = generateToken(
      payload,
      process.env.REFRESH_TOKEN_KEY,
      process.env.REFRESH_TOKEN_EXPIRY
    );

    // 11. Store refresh token in HTTP-only cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite:
        process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    // 12. Return login information
    return res.status(200).json({
      status: "success",
      message: `Welcome back ${user.firstName}.`,
      accessToken,

      user: {
        id: user.id,
        loginId: user.loginId,
        firstName: user.firstName,
        surName: user.surName,
        role: user.role,
        status: user.status,
        isOwner,
      },

      school: {
        id: school.id,
        schoolCode: school.schoolCode,
        schoolName: school.schoolName,
        schoolLevel: school.schoolLevel,
        status: school.status,
      },

      // Role-specific information will be added here
      // as part of hybrid profile loading.
      profile: null,
    });
  } catch (error) {
    console.error("LOGIN_USER_ERROR:", {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      error,
    });

    return next(
      new AppError(
        isDev ? error.message : "Login failed. Please try again.",
        500
      )
    );
  }
};


export const requestNewAccessToken = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    console.log("refreshToken", refreshToken);

    if (!refreshToken) {
      return next(
        new AppError("Refresh token not found.", 401)
      );
    }

    jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_KEY,
      (err, decode) => {
        if (err) {
          return next(
            new AppError(
              "Invalid or expired refresh token",
              401
            )
          );
        }

        const payload = {
          id: decode.id,
          firstName: decode.firstName,
          surName: decode.surName,
          email: decode.email,
          gender: decode.gender,
          role: decode.role,
        };

        const newAccessToken = generateToken(
          payload,
          process.env.ACCESS_TOKEN_KEY,
          process.env.ACCESS_TOKEN_EXPIRY
        );

        return res.status(201).json({
          status: "success",
          message: "New access token was generated successfully",
          accessToken: newAccessToken,
        });
      }
    );
  } catch (err) {
    const errorContext = {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
    };

    console.error(
      "REQUEST_NEW_ACCESS_TOKEN_ERROR: Failed to generate new access token",
      {
        context: errorContext,
        error: err,
      }
    );

    return next(new AppError(err.message, 500));
  }
};


export const getLoggedInUser = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return next(
        new AppError("User not authenticated or session is invalid.", 401)
      );
    }

    const user = await User.findByPk(userId, {
      attributes: { exclude: ["passwordHash"] },
    });

    if (!user) {
      return next(
        new AppError("The user belonging to this account no longer exists.", 404)
      );
    }

    if (user.status !== "ACTIVE") {
      return next(
        new AppError(
          "Your account is not active. Please contact your school administrator.",
          403
        )
      );
    }

    let isOwner = false;
    let studentProfile = null;

    if (user.role !== "STUDENT") {
      const owner = await Owner.findOne({
        where: {
          schoolId: user.schoolId,
          userId: user.id,
        },
      });
      isOwner = Boolean(owner);
    } else {
      studentProfile = await Student.findOne({
        where: {
          userId: user.id,
        },
      });
    }

    const school = await School.findByPk(user.schoolId);

    const userData = {
      id: user.id,
      loginId: user.loginId,
      firstName: user.firstName,
      surName: user.surName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      profileImageUrl: user.profileImageUrl,
      role: user.role,
      status: user.status,
      isOwner,
      createdAt: user.createdAt,
    };

  const schoolData = school
  ? {
      id: school.id,
      schoolCode: school.schoolCode,
      schoolName: school.schoolName,
      schoolLevel: school.schoolLevel,
      ownershipType: school.ownershipType,
      status: school.status,
      logoUrl: school.logoUrl,
    }
  : null;

  console.log('schoolData, from getLoggedInUser:', schoolData);

    return res.status(200).json({
      status: "success",
      user: userData,
      school: schoolData,
      student: studentProfile,
      data: {
        user: userData,
        school: schoolData,
        student: studentProfile,
      },
    });
  } catch (error) {
    console.error("GET_LOGGED_IN_USER_ERROR:", {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      error,
    });

    return next(
      new AppError(
        isDev ? error.message : "Failed to retrieve logged-in user profile.",
        500
      )
    );
  }
};


export const forgotLoginId = async (req, res, next) => {
  try {
    const { email } = req.body;
    const normalizedEmail = email.trim().toLowerCase();

    // =========================================================
    // 3. FIND USER
    // =========================================================

    const user = await User.findOne({
      where: {
        email: normalizedEmail,
      },
    });

    // =========================================================
    // 4. GENERIC RESPONSE IF ACCOUNT DOES NOT EXIST
    // =========================================================
    //
    // We intentionally do NOT tell the user whether the email
    // exists or not. This prevents account enumeration.
    //
    // The frontend receives the same success response whether
    // the email belongs to an account or not.
    // =========================================================

    if (!user) {
      return res.status(200).json({
        status: "success",
        message:
          "If an account matches that email address, your Login ID recovery instructions have been sent to it.",
      });
    }

    // =========================================================
    // 5. CHECK USER ACCOUNT STATUS
    // =========================================================
    //
    // We do not send recovery information for inactive accounts.
    // However, we still return the same generic response.
    // =========================================================

    if (user.status !== "ACTIVE") {
      return res.status(200).json({
        status: "success",
        message:
          "If an account matches that email address, your Login ID recovery instructions have been sent to it.",
      });
    }

    // =========================================================
    // 6. GET SCHOOL INFORMATION
    // =========================================================

    const school = await School.findByPk(user.schoolId);

    if (!school) {
      return res.status(200).json({
        status: "success",
        message:
          "If an account matches that email address, your Login ID recovery instructions have been sent to it.",
      });
    }

    // =========================================================
    // 7. CREATE LOGIN ID RECOVERY EMAIL
    // =========================================================

    const html = `
      <div style="
        font-family: Arial, sans-serif;
        max-width: 600px;
        margin: 0 auto;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        overflow: hidden;
        background-color: #ffffff;
      ">

        <div style="
          background-color: #071A52;
          padding: 20px;
          text-align: center;
        ">
          <h1 style="
            color: #ffffff;
            margin: 0;
            font-size: 24px;
          ">
            ScholaNode
          </h1>
        </div>

        <div style="
          padding: 30px;
          color: #333333;
        ">

          <p style="font-size: 16px;">
            Hello ${user.firstName},
          </p>

          <p style="
            font-size: 16px;
            line-height: 1.6;
          ">
            We received a request to recover the Login ID
            associated with your ScholaNode account at
            <strong>${school.schoolName}</strong>.
          </p>

          <div style="
            background-color: #f8fafc;
            padding: 20px;
            border-radius: 6px;
            margin: 25px 0;
            text-align: center;
          ">

            <p style="
              margin: 0 0 10px 0;
              font-size: 14px;
              color: #777777;
            ">
              Your Login ID
            </p>

            <p style="
              margin: 0;
              font-size: 22px;
              font-weight: bold;
              color: #071A52;
              letter-spacing: 1px;
            ">
              ${user.loginId}
            </p>

          </div>

          <p style="
            font-size: 14px;
            color: #777777;
            line-height: 1.6;
          ">
            You can use this Login ID together with your password
            to sign in to ScholaNode.
          </p>

          <p style="
            font-size: 14px;
            color: #777777;
            line-height: 1.6;
          ">
            If you did not request this recovery, you can safely
            ignore this email. Your account password has not been changed.
          </p>

          <p style="
            font-size: 14px;
            color: #777777;
          ">
            Best regards,<br>
            The ScholaNode Team
          </p>

        </div>

        <div style="
          background-color: #f9f9f9;
          padding: 15px;
          text-align: center;
          font-size: 12px;
          color: #999999;
        ">
          &copy; ${new Date().getFullYear()} ScholaNode.
          All rights reserved.
        </div>

      </div>
    `;

    // =========================================================
    // 8. SEND EMAIL
    // =========================================================

    try {
      await sendEmail({
        to: normalizedEmail,
        subject: "Your ScholaNode Login ID",
        html,
      });
    } catch (emailError) {
      console.error(
        "FORGOT_LOGIN_ID_EMAIL_ERROR: Failed to send Login ID recovery email",
        {
          email: normalizedEmail,
          userId: user.id,
          error: emailError,
        }
      );

      return next(
        new AppError(
          isDev
            ? emailError.message
            : "Failed to send recovery email. Please try again.",
          500
        )
      );
    }

    // =========================================================
    // 9. SUCCESS RESPONSE
    // =========================================================

    return res.status(200).json({
      status: "success",
      message:
        "If an account matches that email address, your Login ID recovery instructions have been sent to it.",
    });

  } catch (error) {
    // =========================================================
    // UNEXPECTED ERROR
    // =========================================================

    console.error("FORGOT_LOGIN_ID_ERROR:", {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      error,
    });

    return next(
      new AppError(
        isDev
          ? error.message
          : "Unable to process Login ID recovery. Please try again.",
        500
      )
    );
  }
};


export const forgotPassword = async (req, res, next) => {
  const transaction = await dbConnection.transaction();

  try {
    const { email } = req.body;
    const normalizedEmail = email.trim().toLowerCase();

    // =========================================================
    // 3. FIND ACTIVE USER
    // =========================================================
    //
    // We intentionally only process ACTIVE accounts.
    //
    // If the account does not exist or is not active, we still
    // return the same generic response to prevent account
    // enumeration.
    // =========================================================

    const user = await User.findOne({
      where: {
        email: normalizedEmail,
        status: "ACTIVE",
      },
      transaction,
    });

    // =========================================================
    // 4. GENERIC RESPONSE FOR UNKNOWN/INACTIVE ACCOUNT
    // =========================================================
    //
    // Do not reveal whether the email belongs to an account.
    // =========================================================

    if (!user) {
      await transaction.rollback();

      return res.status(200).json({
        status: "success",
        message:
          "If an account matches that email address, password recovery instructions have been sent to it.",
      });
    }

    // =========================================================
    // 5. GENERATE RECOVERY CODE
    // =========================================================

    const recoveryCode = generateVerificationCode();
    const expiryTime = generateExpiryTime();

    // =========================================================
    // 6. REMOVE OLD RECOVERY CODES
    // =========================================================

    await VerificationCode.destroy({
      where: {
        userEmail: normalizedEmail,
      },
      transaction,
    });

    // =========================================================
    // 7. CREATE NEW RECOVERY CODE
    // =========================================================

    await VerificationCode.create(
      {
        code: recoveryCode,
        expiryTime,
        userEmail: normalizedEmail,
      },
      {
        transaction,
      }
    );

    // =========================================================
    // 8. BUILD RECOVERY EMAIL
    // =========================================================

    const html = `
      <div style="
        font-family: Arial, sans-serif;
        max-width: 600px;
        margin: 0 auto;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        overflow: hidden;
        background-color: #ffffff;
      ">

        <div style="
          background-color: #071A52;
          padding: 20px;
          text-align: center;
        ">
          <h1 style="
            color: #ffffff;
            margin: 0;
            font-size: 24px;
          ">
            ScholaNode Account Recovery
          </h1>
        </div>

        <div style="
          padding: 30px;
          color: #333333;
        ">

          <p style="font-size: 16px;">
            Hello ${user.firstName},
          </p>

          <p style="
            font-size: 16px;
            line-height: 1.6;
          ">
            We received a request to reset the password for your
            ScholaNode account.
            If you initiated this request, use the secure
            verification code below:
          </p>

          <div style="
            text-align: center;
            margin: 30px 0;
          ">
            <span style="
              font-size: 32px;
              font-weight: bold;
              color: #071A52;
              background-color: #eef2ff;
              padding: 15px 30px;
              border-radius: 5px;
              letter-spacing: 5px;
              border: 1px dashed #071A52;
            ">
              ${recoveryCode}
            </span>
          </div>

          <p style="
            font-size: 14px;
            color: #555555;
            line-height: 1.6;
          ">
            <strong>Security Note:</strong>
            This verification code will expire in 15 minutes.
            If you did not request a password reset, you can
            safely ignore this email.
          </p>

          <p style="
            font-size: 14px;
            color: #777777;
          ">
            Best regards,<br>
            The ScholaNode Security Team
          </p>

        </div>

        <div style="
          background-color: #f9f9f9;
          padding: 15px;
          text-align: center;
          font-size: 12px;
          color: #999999;
        ">
          &copy; ${new Date().getFullYear()} ScholaNode.
          All rights reserved.
        </div>

      </div>
    `;

    // =========================================================
    // 9. SEND RECOVERY EMAIL
    // =========================================================

    try {
      await sendEmail({
        to: normalizedEmail,
        subject: "Reset your ScholaNode password",
        html,
      });
    } catch (emailError) {
      console.error(
        "FORGOT_PASSWORD_EMAIL_ERROR: Failed to send password recovery email",
        {
          email: normalizedEmail,
          userId: user.id,
          error: emailError,
        }
      );

      await transaction.rollback();

      return next(
        new AppError(
          isDev
            ? emailError.message
            : "Failed to send recovery email. Please try again.",
          500
        )
      );
    }

    // =========================================================
    // 10. COMMIT DATABASE CHANGES
    // =========================================================

    await transaction.commit();

    // =========================================================
    // 11. GENERIC SUCCESS RESPONSE
    // =========================================================

    return res.status(200).json({
      status: "success",
      message:
        "If an account matches that email address, password recovery instructions have been sent to it.",
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

    console.error("FORGOT_PASSWORD_ERROR:", {
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
          : "Unable to process password recovery. Please try again.",
        500
      )
    );
  }
};

export const resetPassword = async (req, res, next) => {
  const transaction = await dbConnection.transaction();

  try {
    const { password, token } = req.body;

    // =========================================================
    // 2. VERIFY PASSWORD RESET TOKEN
    // =========================================================

    let decoded;

    try {
      decoded = jwt.verify(
        token,
        process.env.PASSWORD_RESET_TOKEN_KEY
      );
    } catch (jwtError) {
      await transaction.rollback();

      return next(
        new AppError(
          "Your password reset session has expired or is invalid. Please request a new recovery code.",
          401
        )
      );
    }

    // =========================================================
    // 3. VERIFY TOKEN PURPOSE
    // =========================================================
    //
    // This prevents an ordinary login/access token from being
    // used as a password-reset authorization token.
    // =========================================================

    if (decoded.purpose !== "password_reset") {
      await transaction.rollback();

      return next(
        new AppError(
          "Invalid password reset token.",
          403
        )
      );
    }

    // =========================================================
    // 4. FIND ACTIVE USER
    // =========================================================

    const user = await User.findOne({
      where: {
        id: decoded.id,
        email: decoded.email,
        status: "ACTIVE",
      },
      transaction,
    });

    // =========================================================
    // 5. USER VALIDATION
    // =========================================================

    if (!user) {
      await transaction.rollback();

      return next(
        new AppError(
          "The user account matching this recovery session could not be found.",
          404
        )
      );
    }

    // =========================================================
    // 6. HASH NEW PASSWORD
    // =========================================================

    const hashedPassword = await bcrypt.hash(
      password,
      12
    );

    // =========================================================
    // 7. UPDATE PASSWORD
    // =========================================================

    user.passwordHash = hashedPassword;

    await user.save({
      transaction,
    });

    // =========================================================
    // 8. COMMIT PASSWORD CHANGE
    // =========================================================

    await transaction.commit();

    // =========================================================
    // 9. SUCCESS RESPONSE
    // =========================================================

    return res.status(200).json({
      status: "success",
      message:
        "Your ScholaNode account password has been updated successfully.",
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

    console.error("RESET_PASSWORD_ERROR:", {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      error,
    });

    return next(
      new AppError(
        isDev
          ? error.message
          : "Unable to reset your password. Please try again.",
        500
      )
    );
  }
};


