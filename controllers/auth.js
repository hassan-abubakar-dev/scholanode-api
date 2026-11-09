import { handleControllerError } from "../utils/controllerError.js";
import { User, School, Owner, Student, Class, VerificationCode, GateScanner } from "../relationships/associations.js";
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
import { PENDING_PROFILE_NAMES } from '../utils/pendingProfile.js';

import {
  getPrivateFileUrl,
  getPublicFileUrl,
} from "../services/storage/r2.service.js";


dotenv.config();

const isDev = process.env.NODE_ENV === 'development';

// Staff roles that may scan only after an active GateScanner permission exists.
const STAFF_SCANNER_ROLES = [
  "LEADER",
  "VICE_LEADER",
  "ADMINISTRATOR",
  "EXAM_OFFICER",
  "STAFF",
];

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
        mustChangePassword: user.mustChangePassword,
        profileCompleted: user.profileCompleted,
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
    if (err instanceof AppError) {
      return next(err);
    }

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
    let isFormMaster = false;
    let formClass = null;

    // Check whether the user is a school owner.
    if (user.role !== "STUDENT") {
      const owner = await Owner.findOne({
        where: {
          schoolId: user.schoolId,
          userId: user.id,
        },
      });

      isOwner = Boolean(owner);
    } else {
      // Retrieve the student's profile.
      studentProfile = await Student.findOne({
        where: {
          userId: user.id,
        },
      });
    }

    // Only STAFF users can be form masters.
    if (user.role === "STAFF") {
      const assignedClass = await Class.findOne({
        where: {
          schoolId: user.schoolId,
          formMasterId: user.id,
        },
        attributes: ["id", "classLevel", "arm"],
      });

      if (assignedClass) {
        isFormMaster = true;

        formClass = {
          id: assignedClass.id,
          classLevel: assignedClass.classLevel,
          arm: assignedClass.arm,
        };
      }
    }

    // Security users scan directly; other staff need an active
    // GateScanner permission granted by management.
    let canScanStudents = user.role === "SECURITY";

    if (!canScanStudents && STAFF_SCANNER_ROLES.includes(user.role)) {
      const scannerPermission = await GateScanner.findOne({
        where: {
          schoolId: user.schoolId,
          userId: user.id,
          isActive: true,
        },
        attributes: ["id"],
      });

      canScanStudents = Boolean(scannerPermission);
    }

    // Retrieve school information.
    const school = await School.findByPk(user.schoolId);
    const profileImageUrl = user.profileImageKey
      ? await getPrivateFileUrl(user.profileImageKey)
      : null;

    const userData = {
      id: user.id,
      loginId: user.loginId,
      firstName: user.firstName,
      surName: user.surName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      profileImageKey: user.profileImageKey,
      profileImageUrl,
      role: user.role,
      status: user.status,
      isOwner,
      isFormMaster,
      formClass,
      canScanStudents,
      mustChangePassword: user.mustChangePassword,
      profileCompleted: user.profileCompleted,
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
          logoUrl: getPublicFileUrl(school.logoKey),
        }
      : null;

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
  let transaction;
  let verificationRecord = null;

  const genericResponse = {
    status: "success",
    message:
      "If an account matches that email address, password recovery instructions have been sent to it.",
  };

  let normalizedEmail;

  try {
    const { email } = req.body;
    normalizedEmail = email.trim().toLowerCase();

    // =========================================================
    // 1. START DATABASE TRANSACTION
    // =========================================================

    transaction = await dbConnection.transaction();

    // =========================================================
    // 2. FIND ACTIVE USER
    // =========================================================

    const user = await User.findOne({
      where: {
        email: normalizedEmail,
        status: "ACTIVE",
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    // =========================================================
    // 3. GENERIC RESPONSE FOR UNKNOWN/INACTIVE ACCOUNTS
    // =========================================================

    if (!user) {
      await transaction.rollback();
      transaction = null;

      return res.status(200).json(genericResponse);
    }

    // =========================================================
    // 4. GENERATE RECOVERY CODE
    // =========================================================

    const recoveryCode = generateVerificationCode();
    const expiryTime = generateExpiryTime();

    // =========================================================
    // 5. CREATE NEW PASSWORD RESET CODE
    // =========================================================
    //
    // We explicitly specify:
    // - userId
    // - purpose
    //
    // Existing codes are not deleted yet. We preserve them
    // until the new email has been successfully sent.
    // =========================================================

    verificationRecord = await VerificationCode.create(
      {
        code: recoveryCode,
        expiryTime,
        userEmail: normalizedEmail,
        userId: user.id,
        purpose: "PASSWORD_RESET",
      },
      {
        transaction,
      }
    );

    // =========================================================
    // 6. COMMIT BEFORE SENDING EMAIL
    // =========================================================

    await transaction.commit();
    transaction = null;

    // =========================================================
    // 7. BUILD RECOVERY EMAIL
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
            This verification code will expire in 10 minutes.
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
    // 8. SEND RECOVERY EMAIL
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

      // Remove the newly created code because the email
      // could not be delivered.
      try {
        await verificationRecord.destroy();
      } catch (cleanupError) {
        console.error(
          "FORGOT_PASSWORD_CODE_CLEANUP_ERROR:",
          {
            userId: user.id,
            error: cleanupError,
          }
        );
      }

      // Keep the response generic to prevent account enumeration.
      return res.status(200).json(genericResponse);
    }

    // =========================================================
    // 9. REMOVE PREVIOUS PASSWORD RESET CODES
    // =========================================================
    //
    // Only remove codes belonging to this purpose.
    // Registration and profile-email-change codes remain intact.
    // =========================================================

    try {
      await VerificationCode.destroy({
        where: {
          userEmail: normalizedEmail,
          purpose: "PASSWORD_RESET",
          id: {
            [Op.ne]: verificationRecord.id,
          },
        },
      });
    } catch (cleanupError) {
      console.error(
        "FORGOT_PASSWORD_OLD_CODES_CLEANUP_ERROR:",
        {
          email: normalizedEmail,
          userId: user.id,
          error: cleanupError,
        }
      );
    }

    // =========================================================
    // 10. GENERIC SUCCESS RESPONSE
    // =========================================================

    return res.status(200).json(genericResponse);

  } catch (error) {
    // =========================================================
    // 11. ROLLBACK IF TRANSACTION IS STILL OPEN
    // =========================================================

    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    console.error("FORGOT_PASSWORD_ERROR:", {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      email: normalizedEmail,
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


export const logOutUser = async (req, res, next) => {
  try {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite:
        process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
    });

    return res.status(200).json({
      status: "success",
      message: "Logged out successfully.",
    });
  } catch (err) {
    if (err instanceof AppError) {
      return next(err);
    }

    console.error("LOGOUT_USER_ERROR:", {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      error: err,
    });

    return next(
      new AppError(
        isDev ? err.message : "Failed to log out.",
        500
      )
    );
  }
};

export const changePassword = async (req, res, next) => {
  try {
    // 1. Get the authenticated user.
    const userId = req.user?.id;

    if (!userId) {
      return next(
        new AppError("Authentication is required.", 401)
      );
    }

    // 2. Read validated request data.
    const { currentPassword, newPassword } = req.body;

    // 3. Find the authenticated user's account.
    const user = await User.findByPk(userId);

    if (!user) {
      return next(
        new AppError("User account not found.", 404)
      );
    }

    // 4. Verify the current password.
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash
    );

    if (!isPasswordValid) {
      return next(
        new AppError("Your current password is incorrect.", 400)
      );
    }

    // 5. Prevent reusing the current password.
    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      return next(
        new AppError(
          "Your new password must be different from your current password.",
          400
        )
      );
    }

    // 6. Hash and save the new password.
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await user.update({
      passwordHash,
      mustChangePassword: false,
    });

    // 7. Return confirmation without exposing password data.
    return res.status(200).json({
      status: "success",
      message: "Your password has been changed successfully.",
    });
  } catch (error) {
    console.error("CHANGE_PASSWORD_ERROR:", {
      url: req.originalUrl,
      method: req.method,
      error,
    });

    return handleControllerError(error, next, req, "AUTH_CONTROLLER_ERROR", "Unable to process this request. Please try again.");
  }
};

// An invited account carries placeholder names and no contact number until its
// owner signs in, so the first-login form is the point where the profile stops
// being a placeholder.
export const completeProfile = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return next(new AppError("Authentication is required.", 401));
    }

    const user = await User.findByPk(userId);

    if (!user) {
      return next(new AppError("User account not found.", 404));
    }

    const isStudent = user.role === "STUDENT";
    const { firstName, surName, phoneNumber } = req.body;

    // A student's name belongs to the school, exactly as on the profile page.
    if (isStudent) {
      if (firstName !== undefined || surName !== undefined) {
        return next(
          new AppError(
            "Students cannot update their name. Please contact your school office.",
            403
          )
        );
      }
    } else {
      const names = [firstName, surName];

      if (!names.every((name) => typeof name === "string" && name.length >= 2)) {
        return next(
          new AppError("Enter your real first name and surname.", 400)
        );
      }

      // The invitation placeholders are not a name, whatever the casing.
      const placeholders = Object.values(PENDING_PROFILE_NAMES).map((name) =>
        name.toLowerCase()
      );

      if (names.some((name) => placeholders.includes(name.toLowerCase()))) {
        return next(
          new AppError("Enter your real first name and surname.", 400)
        );
      }

      user.firstName = firstName;
      user.surName = surName;
    }

    // Phone is optional for every role; an empty field simply leaves it unset.
    if (phoneNumber) {
      user.phoneNumber = phoneNumber;
    }

    user.profileCompleted = true;

    await user.save();

    return res.status(200).json({
      status: "success",
      message: "Your profile has been completed. Welcome to ScholaNode.",
      user: {
        id: user.id,
        loginId: user.loginId,
        firstName: user.firstName,
        surName: user.surName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        status: user.status,
        mustChangePassword: user.mustChangePassword,
        profileCompleted: user.profileCompleted,
      },
    });
  } catch (error) {
    console.error("COMPLETE_PROFILE_ERROR:", {
      url: req.originalUrl,
      method: req.method,
      error,
    });

    return handleControllerError(error, next, req, "AUTH_CONTROLLER_ERROR", "Unable to process this request. Please try again.");
  }
};