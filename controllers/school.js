import { handleControllerError } from "../utils/controllerError.js";
import { School, User, Session, Term, Class, Subject, Owner, VerificationCode } from "../relationships/associations.js";
import {
  canonicalizeClassLevel,
  canonicalizeArm,
  normalizeOrInferEducationSection,
} from "../utils/classCanonical.js";
/**
 * @file controllers/school.js
 * @description Controller for school registration and management
 */

import bcrypt from 'bcryptjs';
import sendEmail from '../config/emailService.js';

import { Op, col, fn, where as sequelizeWhere } from 'sequelize';

import { dbConnection } from "../config/db.js";

import { resolvePricing } from "../services/pricing.js";
import path from 'path';
import {
  uploadPublicFile,
  getPublicFileUrl,
  getPublicFileMetadata,
  deletePublicFile,
} from "../services/storage/r2.service.js";
import generateStaffLoginId from '../services/generateStaffLoginId.js';
import AppError from '../utils/AppError.js';
import generateExpiryTime from '../utils/experyTime.js';
import generateVerificationCode from '../utils/verificationCode.js';

const isDev = process.env.NODE_ENV === "development";

const MAX_SCHOOL_LOGO_SIZE = 5 * 1024 * 1024;

const ALLOWED_SCHOOL_LOGO_TYPES = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);

const rollbackTransaction = async (transaction, label) => {
  if (!transaction || transaction.finished) {
    return;
  }

  try {
    await transaction.rollback();
  } catch (error) {
    console.error(label, {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  }
};


export const checkSchoolCode = async (req, res, next) => {
  try {
    const schoolCode = req.query.schoolCode?.trim();
    const school = await School.findOne({ where: { schoolCode } });

    return res.status(200).json({
      status: 'success',
      schoolCode,
      available: !school,
    });
  } catch (error) {
    return handleControllerError(
      error,
      next,
      req,
      "CHECK_SCHOOL_CODE_ERROR",
      "Failed to check school code."
    );
  }
};

export const getSchoolByCode = async (req, res, next) => {
  try {
    const { code } = req.params;

    const school = await School.findOne({
      where: {
        schoolCode: code.trim().toUpperCase(),
        status: {
          [Op.in]: ['ACTIVE', 'PENDING_ACTIVATION'],
        },
      },
      attributes: [
        'schoolName',
        'schoolCode',
        'schoolLevel',
        'ownershipType',
        'logoKey',
        'welcomeMessage',
        'supportEmail',
        'supportPhone',
      ],
    });

    if (!school) {
      return res.status(404).json({
        status: 'error',
        message: 'School not found.',
      });
    }

    const schoolData = school.toJSON();
    delete schoolData.logoKey;

    return res.status(200).json({
      status: 'success',
      data: {
        ...schoolData,
        logoUrl: getPublicFileUrl(school.logoKey),
      },
    });
  } catch (error) {
    return handleControllerError(
      error,
      next,
      req,
      "GET_SCHOOL_BY_CODE_ERROR",
      "Failed to fetch school."
    );
  }
};

/**
 * Register a new school with admin user and plan
 * Request body: { school, admin, plan }
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const registerSchool = async (req, res, next) => {
  let transaction;

  try {
    transaction = await dbConnection.transaction();
    const {
      school: schoolData,
      admin: adminData,
      plan: planData,
    } = req.body;

    const {
      schoolName,
      schoolCode,
      address,
      schoolLevel,
      ownershipType,
    } = schoolData;

    const {
      firstName,
      surName,
      email: userEmail,
      password,
      role,
    } = adminData;

    const {
      plan,
      tierId,
      billingCycle,
    } = planData;

    // =========================================================
    // NORMALIZE VALUES
    // =========================================================

    const normalizedSchoolName = schoolName.trim();
    const normalizedSchoolCode = schoolCode.trim().toUpperCase();
    const normalizedUserEmail = userEmail.trim().toLowerCase();
    const normalizedAddress = address.trim();

    const normalizedSchoolLevel = schoolLevel.trim().toUpperCase();
    const normalizedOwnershipType = ownershipType.trim().toUpperCase();
    const normalizedRole = role.trim().toUpperCase();
    const allowedRegistrationRoles = [
      "LEADER",
      "VICE_LEADER",
      "ADMINISTRATOR",
      "EXAM_OFFICER",
      "STAFF",
    ];

    if (!allowedRegistrationRoles.includes(normalizedRole)) {
      await transaction.rollback();

      return res.status(400).json({
        status: "error",
        message: `Invalid role. Allowed values: ${allowedRegistrationRoles.join(", ")}.`,
      });
    }

    const databaseRole = normalizedRole;
    const normalizedPlan = plan.trim().toUpperCase();

    // =========================================================
    // VALIDATE TIER / BILLING CYCLE
    // =========================================================

    let resolvedPricing;
    try {
      resolvedPricing = resolvePricing({
        plan: normalizedPlan,
        tierId: tierId == null ? null : String(tierId).trim(),
        billingCycle: billingCycle == null
          ? null
          : String(billingCycle).trim().toUpperCase(),
      });
    } catch (error) {
      await transaction.rollback();
      return res.status(400).json({
        status: "error",
        message: error.message,
      });
    }

    const normalizedTierId = resolvedPricing.tierId;
    const normalizedBillingCycle = resolvedPricing.billingCycle;
    const planPrice = resolvedPricing.price;

    // Do not replace an existing pending registration without proving
    // ownership through the existing verification flow.
    const pendingSchool = await School.findOne({
      where: {
        [Op.and]: [
          sequelizeWhere(
            fn("LOWER", col("schoolName")),
            normalizedSchoolName.toLowerCase()
          ),
          sequelizeWhere(
            fn("LOWER", col("address")),
            normalizedAddress.toLowerCase()
          ),
        ],
        status: "PENDING_VERIFICATION",
      },
      transaction,
    });

    if (pendingSchool) {
      await transaction.rollback();
      return res.status(409).json({
        status: "error",
        message: "A registration for this school is already being processed.",
      });
    }

    // =========================================================
    // 10. CHECK SCHOOL CODE
    // =========================================================

    const existingSchoolCode = await School.findOne({
      where: {
        schoolCode: normalizedSchoolCode,
      },
      transaction,
    });

    if (existingSchoolCode) {
      await transaction.rollback();

      return res.status(400).json({
        status: "error",
        message: "School code already in use.",
      });
    }

    // =========================================================
    // 11. CHECK USER EMAIL
    // =========================================================

    const existingUserEmail = await User.findOne({
      where: {
        email: normalizedUserEmail,
      },
      transaction,
    });

    if (existingUserEmail) {
      await transaction.rollback();

      return res.status(400).json({
        status: "error",
        message: "User email already registered.",
      });
    }

    // =========================================================
    // 12. CREATE SCHOOL
    // =========================================================

    const newSchool = await School.create(
      {
        schoolName: normalizedSchoolName,
        schoolCode: normalizedSchoolCode,
        address: normalizedAddress,

        schoolLevel: normalizedSchoolLevel,
        ownershipType: normalizedOwnershipType,

        // Temporary plan selection fields
        selectedPlan: normalizedPlan,
        selectedTierId: normalizedPlan === "FREE" ? null : normalizedTierId,
        selectedBillingCycle: normalizedPlan === "FREE" ? null : normalizedBillingCycle,

        // Registration has not yet been verified.
        status: "PENDING_VERIFICATION",

      },
      {
        transaction,
      }
    );

    // Generate the ID inside the same transaction that creates the user.
    const loginId = await generateStaffLoginId({
      schoolId: newSchool.id,
      transaction,
    });

    // =========================================================
    // 14. HASH PASSWORD
    // =========================================================

    const passwordHash = await bcrypt.hash(password, 12);

    // =========================================================
    // 15. CREATE USER
    // =========================================================
    //
    // Role comes from the frontend.
    // We do NOT automatically force ADMINISTRATOR.
    // =========================================================

    const newUser = await User.create(
      {
        schoolId: newSchool.id,

        firstName: firstName.trim(),
        surName: surName.trim(),

        email: normalizedUserEmail,
        passwordHash,

        role: databaseRole,
        loginId,

      },
      {
        transaction,
      }
    );

    // =========================================================
    // 16. CREATE OWNER RELATIONSHIP
    // =========================================================

    await Owner.create(
      {
        schoolId: newSchool.id, 
        userId: newUser.id,
      },
      {
        transaction,
      }
    );

    // =========================================================
    // 17. CREATE VERIFICATION CODE
    // =========================================================

    const verificationCode = generateVerificationCode();
    const expiryTime = generateExpiryTime();

   await VerificationCode.create(
  {
    code: verificationCode,
    expiryTime,
    userEmail: normalizedUserEmail,
    userId: newUser.id,
    purpose: "SCHOOL_REGISTRATION",
  },
  { transaction }
);

    // =========================================================
    // 18. CREATE VERIFICATION EMAIL
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
          background-color: #166534;
          padding: 20px;
          text-align: center;
        ">
          <h1 style="
            color: #ffffff;
            margin: 0;
            font-size: 24px;
          ">
            Welcome to ScholaNode
          </h1>
        </div>

        <div style="
          padding: 30px;
          color: #333333;
        ">

          <p style="font-size: 16px;">
            Hello ${escapeHtml(firstName)},
          </p>

          <p style="
            font-size: 16px;
            line-height: 1.6;
          ">
            Thank you for registering
            <strong>${escapeHtml(normalizedSchoolName)}</strong>
            with ScholaNode.
          </p>

          <p style="
            font-size: 16px;
            line-height: 1.6;
          ">
            To complete your registration and verify your email address,
            please use the verification code below:
          </p>

          <div style="
            text-align: center;
            margin: 30px 0;
          ">
            <span style="
              font-size: 32px;
              font-weight: bold;
              color: #166534;
              background-color: #f4f4f4;
              padding: 15px 30px;
              border-radius: 5px;
              letter-spacing: 5px;
            ">
              ${escapeHtml(verificationCode)}
            </span>
          </div>

          <div style="
            background-color: #f8fafc;
            padding: 20px;
            border-radius: 6px;
            margin: 25px 0;
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
              font-size: 18px;
              font-weight: bold;
            ">
              ${escapeHtml(loginId)}
            </p>

          </div>

          <p style="
            font-size: 14px;
            color: #777777;
            line-height: 1.6;
          ">
            Keep your Login ID for future access to ScholaNode.
            Your password is not included in this email for security reasons.
          </p>

          <p style="
            font-size: 14px;
            color: #777777;
            line-height: 1.6;
          ">
            This code will expire in 10 minutes.
            If you did not register this school, please ignore this email.
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

    try {
      await sendEmail({
        to: normalizedUserEmail,
        subject: "Verify your ScholaNode account",
        html,
      });
    } catch (emailError) {
      console.error(
        "REGISTER_SCHOOL_EMAIL_ERROR: Failed to send verification email",
        {
          schoolId: newSchool.id,
          error: emailError.message,
        }
      );
      await rollbackTransaction(
        transaction,
        "REGISTER_SCHOOL_EMAIL_ROLLBACK_ERROR"
      );

      return res.status(500).json({
        status: "error",
        message:
          "Registration could not be completed because the verification email could not be sent. Please try again.",
      });
    }

    await transaction.commit();

    return res.status(201).json({
      status: "success",
      message: `Registration successful. A verification code has been sent to ${normalizedUserEmail}.`,

      data: {
        school: {
          id: newSchool.id,
          schoolName: newSchool.schoolName,
          schoolCode: newSchool.schoolCode,
          schoolLevel: newSchool.schoolLevel,
          ownershipType: newSchool.ownershipType,
          status: newSchool.status,
        },

        user: {
          id: newUser.id,
          firstName: newUser.firstName,
          surName: newUser.surName,
          loginId: newUser.loginId,
          email: newUser.email,
          role: newUser.role,
        },

        plan: {
          plan: normalizedPlan,
          tierId: normalizedTierId,
          billingCycle: normalizedBillingCycle,
          price: planPrice,
        },
      },
    });
  } catch (error) {
    // =========================================================
    // UNEXPECTED ERROR
    // =========================================================

    await rollbackTransaction(transaction, "REGISTER_SCHOOL_ROLLBACK_ERROR");

    console.error("REGISTER_SCHOOL_ERROR:", {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    });

    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        status: "error",
        message: "A school or account with these details already exists.",
      });
    }

    return res.status(500).json({
      status: "error",
      message: isDev
        ? error.message
        : "Failed to register school.",
    });
  }
};


export const getSchoolSetupProgress = async (req, res, next) => {
  try {
    // 1. Get authenticated school
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return next(
        new AppError("Authenticated school not found.", 401)
      );
    }

    // 2. Get school
    const school = await School.findByPk(schoolId);

    if (!school) {
      return next(
        new AppError("School not found.", 404)
      );
    }

    // 3. Check setup fields
    const supportEmailCompleted = Boolean(
      school.supportEmail?.trim()
    );

    const supportPhoneCompleted = Boolean(
      school.supportPhone?.trim()
    );

    const logoCompleted = Boolean(school.logoKey?.trim());

    const welcomeMessageCompleted = Boolean(
      school.welcomeMessage?.trim()
    );

    // 4. Calculate progress
    const completedSteps = [
      supportEmailCompleted,
      supportPhoneCompleted,
      logoCompleted,
      welcomeMessageCompleted,
    ].filter(Boolean).length;

    const totalSteps = 4;

    const progress = Math.round(
      (completedSteps / totalSteps) * 100
    );

    // 5. Success response
    return res.status(200).json({
      success: true,
      data: {
        progress,
        completed: progress === 100,
        steps: {
          supportEmail: supportEmailCompleted,
          supportPhone: supportPhoneCompleted,
          logo: logoCompleted,
          welcomeMessage: welcomeMessageCompleted,
        },
      },
    });
  } catch (error) {
    return handleControllerError(error, next, req, "SCHOOL_CONTROLLER_ERROR", "Unable to process this request. Please try again.");
  }
};

/**
 * Get school details by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */



// Get the authenticated user's school
// Get the authenticated user's school
export const getMySchool = async (req, res, next) => {
  try {
    // schoolId comes from the authenticated user's JWT/payload
    const { schoolId } = req.user;

    if (!schoolId) {
      return next(
        new AppError(
          "School information is not available for this account.",
          400
        )
      );
    }

    const school = await School.findByPk(schoolId, {
      attributes: [
        "id",
        "schoolName",
        "schoolCode",
        "address",
        "schoolLevel",
        "ownershipType",
        "supportEmail",
        "supportPhone",
        "logoKey",
        "welcomeMessage",
        "status",
        "createdAt",
        "updatedAt",
      ],
    });

    if (!school) {
      return next(
        new AppError(
          "School not found.",
          404
        )
      );
    }

    const schoolData = school.toJSON();
    delete schoolData.logoKey;

    const logoUrl = getPublicFileUrl(school.logoKey);

    const steps = {
      supportEmail: Boolean(school.supportEmail?.trim()),
      supportPhone: Boolean(school.supportPhone?.trim()),
      logo: Boolean(school.logoKey?.trim()),
      welcomeMessage: Boolean(school.welcomeMessage?.trim()),
    };

    const totalSteps = Object.keys(steps).length;
    const completedSteps = Object.values(steps).filter(Boolean).length;
    const percentage = Math.round((completedSteps / totalSteps) * 100);

    return res.status(200).json({
      success: true,
      school: {
        ...schoolData,
        logoUrl,
      },
      setupProgress: {
        percentage,
        completed: completedSteps === totalSteps,
        completedSteps,
        totalSteps,
        steps,
      },
    });
  } catch (error) {
    return handleControllerError(error, next, req, "SCHOOL_CONTROLLER_ERROR", "Unable to process this request. Please try again.");
  }
};

/**


/**
 * Update school setup fields (optional fields)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} next - Express next middleware function
 */
export const updateSchoolSetup = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return next(new AppError("Authenticated school not found.", 401));
    }

    const {
      welcomeMessage,
      supportEmail,
      supportPhone,
    } = req.body;

    const updates = {
      welcomeMessage,
      supportEmail,
      supportPhone,
    };

    // Remove fields that were not provided in the request
    Object.keys(updates).forEach((key) => {
      if (updates[key] === undefined) {
        delete updates[key];
      }
    });

    const school = await School.findByPk(schoolId);

    if (!school) {
      return next(new AppError("School not found.", 404));
    }

    await school.update(updates);

    const schoolData = school.toJSON();
    delete schoolData.logoKey;

    return res.status(200).json({
      status: "success",
      message: "School setup updated successfully.",
      data: {
        ...schoolData,
        logoUrl: getPublicFileUrl(school.logoKey),
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      return next(err);
    }

    const errorContext = {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
    };

    console.error("UPDATE_SCHOOL_SETUP_ERROR:", {
      context: errorContext,
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack,
      },
    });

    return next(
      new AppError(
        isDev
          ? err.message
          : "Something went wrong during school setup.",
        500
      )
    );
  }
};

// ======================================================
// REQUEST SCHOOL LOGO UPLOAD
// POST /schools/my-school/logo/upload-url
// ======================================================

export const requestSchoolLogoUpload = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return next(new AppError("Authenticated school not found.", 401));
    }

    const { fileName, contentType, fileSize } = req.body;
    const extension = path.extname(fileName).toLowerCase();
    const allowedExtensions = ALLOWED_SCHOOL_LOGO_TYPES[contentType];

    if (!allowedExtensions || !allowedExtensions.includes(extension)) {
      throw new AppError(
        "Only JPEG, PNG and WebP school logos are allowed.",
        400
      );
    }

    if (fileSize > MAX_SCHOOL_LOGO_SIZE) {
      throw new AppError("School logo must not exceed 5MB.", 400);
    }

    const school = await School.findByPk(schoolId);

    if (!school) {
      return next(new AppError("School not found.", 404));
    }

    const { uploadUrl, key, publicUrl } = await uploadPublicFile({
      folder: `schools/${schoolId}/logo`,
      originalName: fileName,
      contentType,
    });

    return res.status(200).json({
      success: true,
      message: "School logo upload URL generated successfully.",
      uploadUrl,
      key,
      publicUrl,
      expiresIn: 300,
    });
  } catch (error) {
    return handleControllerError(error, next, req, "SCHOOL_CONTROLLER_ERROR", "Unable to process this request. Please try again.");
  }
};

// ======================================================
// CONFIRM SCHOOL LOGO UPLOAD
// PATCH /schools/my-school/logo
// ======================================================

export const confirmSchoolLogoUpload = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return next(new AppError("Authenticated school not found.", 401));
    }

    const { key } = req.body;

    // Ensure the object belongs to this authenticated school.
    const expectedPrefix = `schools/${schoolId}/logo/`;

    if (
      !key.startsWith(expectedPrefix) ||
      key.includes("..") ||
      key.includes("\\")
    ) {
      throw new AppError("Invalid school logo reference.", 400);
    }

    const school = await School.findByPk(schoolId);

    if (!school) {
      await deletePublicFile(key).catch(() => {});

      return next(new AppError("School not found.", 404));
    }

    // Verify that the uploaded object actually exists.
    let metadata;

    try {
      metadata = await getPublicFileMetadata(key);
    } catch (error) {
      if (
        error.name === "NotFound" ||
        error.$metadata?.httpStatusCode === 404
      ) {
        throw new AppError("Uploaded school logo was not found.", 400);
      }

      throw error;
    }

    // Verify the actual uploaded content type.
    if (
      !Object.keys(ALLOWED_SCHOOL_LOGO_TYPES).includes(metadata.contentType)
    ) {
      await deletePublicFile(key).catch(() => {});

      throw new AppError("Invalid school logo format.", 400);
    }

    // Verify the actual uploaded file size.
    if (
      !metadata.contentLength ||
      metadata.contentLength > MAX_SCHOOL_LOGO_SIZE
    ) {
      await deletePublicFile(key).catch(() => {});

      throw new AppError("School logo must not exceed 5MB.", 400);
    }

    const oldLogoKey = school.logoKey;

    // Save the new logo reference first.
    await school.update({
      logoKey: key,
    });

    // Delete the previous logo only after successful database update.
    if (oldLogoKey && oldLogoKey !== key) {
      try {
        await deletePublicFile(oldLogoKey);
      } catch (deleteError) {
        // Keep the new logo even if old-file cleanup fails.
        console.error(
          "Failed to delete previous school logo:",
          deleteError
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: "School logo updated successfully.",
      school: {
        id: school.id,
        logoUrl: getPublicFileUrl(key),
      },
    });
  } catch (error) {
    return handleControllerError(error, next, req, "SCHOOL_CONTROLLER_ERROR", "Unable to process this request. Please try again.");
  }
};



export const createAcademicSetup = async (req, res, next) => {
  let transaction;

  try {
    transaction = await dbConnection.transaction();
    const schoolId = req.user?.schoolId;
    const { session, terms } = req.body;

    if (!schoolId) {
      await transaction.rollback();
      return next(new AppError("Authenticated school not found.", 401));
    }

    const school = await School.findByPk(schoolId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!school) {
      await transaction.rollback();
      return next(new AppError("School not found.", 404));
    }

    const normalizedTerms = terms.map((term) => ({
      ...term,
      termName: term.termName.trim().toUpperCase(),
    }));
    const termNames = normalizedTerms.map((term) => term.termName);

    if (
      new Set(termNames).size !== 3 ||
      !["FIRST_TERM", "SECOND_TERM", "THIRD_TERM"].every((name) =>
        termNames.includes(name)
      )
    ) {
      await transaction.rollback();
      return next(
        new AppError(
          "The academic session must contain FIRST_TERM, SECOND_TERM, and THIRD_TERM exactly once.",
          400
        )
      );
    }

    const termsByName = Object.fromEntries(
      normalizedTerms.map((term) => [term.termName, term])
    );
    const orderedTerms = [
      termsByName.FIRST_TERM,
      termsByName.SECOND_TERM,
      termsByName.THIRD_TERM,
    ];

    for (const term of orderedTerms) {
      if (
        new Date(term.startDate) < new Date(session.startDate) ||
        new Date(term.endDate) > new Date(session.endDate)
      ) {
        await transaction.rollback();
        return next(
          new AppError(
            `${term.termName} dates must fall within the academic session.`,
            400
          )
        );
      }
    }

    const firstTerm = termsByName.FIRST_TERM;
    const secondTerm = termsByName.SECOND_TERM;
    const thirdTerm = termsByName.THIRD_TERM;

    if (
      new Date(firstTerm.startDate) >= new Date(secondTerm.startDate) ||
      new Date(secondTerm.startDate) >= new Date(thirdTerm.startDate)
    ) {
      await transaction.rollback();
      return next(
        new AppError(
          "FIRST_TERM, SECOND_TERM, and THIRD_TERM must occur in chronological order.",
          400
        )
      );
    }

    if (
      new Date(firstTerm.endDate) >= new Date(secondTerm.startDate) ||
      new Date(secondTerm.endDate) >= new Date(thirdTerm.startDate)
    ) {
      await transaction.rollback();
      return next(
        new AppError("Academic term dates must not overlap.", 400)
      );
    }

    // 6. Check for an existing session with the same name
    const existingSession = await Session.findOne({
      where: {
        schoolId,
        sessionName: session.sessionName.trim(),
      },
      transaction,
    });

    if (existingSession) {
      await transaction.rollback();
      return next(
        new AppError(
          "An academic session with this name already exists for this school.",
          400
        )
      );
    }

    // 7. Create the session
    const newSession = await Session.create(
      {
        schoolId,
        sessionName: session.sessionName,
        startDate: session.startDate,
        endDate: session.endDate,
        status: "UPCOMING",
        isCurrent: false,
      },
      { transaction }
    );

    // 8. Create the terms
    const newTerms = await Term.bulkCreate(
      normalizedTerms.map((term) => ({
        sessionId: newSession.id,
        termName: term.termName,
        startDate: term.startDate,
        endDate: term.endDate,
        status: "UPCOMING",
        isCurrent: false,
      })),
      {
        transaction,
      }
    );

    // 9. Commit everything
    await transaction.commit();

    // 10. Return the complete onboarding data
    const createdSession = await Session.findByPk(newSession.id, {
      include: [
        {
          model: Term,
          as: "terms",
        },
      ],
    });

    return res.status(201).json({
      status: "success",
      message: "School academic onboarding completed successfully.",
      data: createdSession,
    });
  } catch (err) {
    await rollbackTransaction(transaction, "CREATE_SCHOOL_ONBOARDING_ROLLBACK_ERROR");

    if (err instanceof AppError) {
      return next(err);
    }

    if (err.name === "SequelizeUniqueConstraintError") {
      return next(
        new AppError(
          "An academic session with this name already exists for this school.",
          409
        )
      );
    }

    const errorContext = {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
    };

    console.error("CREATE_SCHOOL_ONBOARDING_ERROR:", {
      context: errorContext,
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack,
      },
    });

    return next(
      new AppError(
        isDev
          ? err.message
          : "Something went wrong during school onboarding.",
        500
      )
    );
  }
};


export const createClassSetup = async (req, res, next) => {
  let transaction;

  try {
    transaction = await dbConnection.transaction();
    const schoolId = req.user?.schoolId;
    const { classes } = req.body;

    if (!schoolId) {
      await transaction.rollback();
      return next(new AppError("Authenticated school not found.", 401));
    }

    const school = await School.findByPk(schoolId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!school) {
      await transaction.rollback();
      return next(new AppError("School not found.", 404));
    }

    const normalizedClasses = classes.map(({ classLevel, arm }) => ({
      schoolId,
      classLevel: classLevel.trim().toUpperCase(),
      arm: typeof arm === "string" && arm.trim()
        ? arm.trim().toUpperCase()
        : null,
    }));

    // Prevent duplicates inside the same request
    const classKeys = normalizedClasses.map(
      ({ classLevel, arm }) => `${classLevel}::${arm ?? ""}`
    );

    if (new Set(classKeys).size !== classKeys.length) {
      await transaction.rollback();
      return next(
        new AppError(
          "Duplicate class level and arm found in the request.",
          400
        )
      );
    }

    // Check whether any of these classes already exist
    const existingClasses = await Class.findAll({
      where: {
        schoolId,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const existingKeys = new Set(
      existingClasses.map(
        ({ classLevel, arm }) =>
          `${classLevel.trim().toUpperCase()}::${
            typeof arm === "string" && arm.trim()
              ? arm.trim().toUpperCase()
              : ""
          }`
      )
    );

    const submittedLevels = new Set(
      normalizedClasses.map(({ classLevel }) => classLevel)
    );

    for (const classItem of normalizedClasses) {
      const key = `${classItem.classLevel}::${classItem.arm ?? ""}`;

      if (existingKeys.has(key)) {
        await transaction.rollback();
        return next(
          new AppError(
            `Class "${classItem.classLevel} ${classItem.arm}" already exists.`,
            409
          )
        );
      }
    }

    for (const level of submittedLevels) {
      const hasUnarmedExisting = existingClasses.some(
        ({ classLevel, arm }) =>
          classLevel.trim().toUpperCase() === level &&
          !(typeof arm === "string" && arm.trim())
      );
      const hasArmedExisting = existingClasses.some(
        ({ classLevel, arm }) =>
          classLevel.trim().toUpperCase() === level &&
          Boolean(typeof arm === "string" && arm.trim())
      );
      const hasUnarmedSubmitted = normalizedClasses.some(
        ({ classLevel, arm }) => classLevel === level && arm === null
      );
      const hasArmedSubmitted = normalizedClasses.some(
        ({ classLevel, arm }) => classLevel === level && arm !== null
      );

      if (
        (hasUnarmedExisting && hasArmedSubmitted) ||
        (hasArmedExisting && hasUnarmedSubmitted) ||
        (hasUnarmedSubmitted && hasArmedSubmitted)
      ) {
        await transaction.rollback();
        return next(
          new AppError(
            `Class level "${level}" cannot have both an unarmed class and armed divisions.`,
            409
          )
        );
      }
    }

    const createdClasses = await Class.bulkCreate(
      normalizedClasses,
      {
        transaction,
      }
    );

    await transaction.commit();

    return res.status(201).json({
      status: "success",
      message: "Class setup completed successfully.",
      data: createdClasses,
    });
  } catch (err) {
    await rollbackTransaction(transaction, "CREATE_CLASS_SETUP_ROLLBACK_ERROR");

    if (err instanceof AppError) {
      return next(err);
    }

    if (err.name === "SequelizeUniqueConstraintError") {
      return next(
        new AppError(
          "One or more classes already exist for this school.",
          409
        )
      );
    }

    const errorContext = {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
    };

    console.error("CREATE_CLASS_SETUP_ERROR:", {
      context: errorContext,
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack,
      },
    });

    return next(
      new AppError(
        isDev
          ? err.message
          : "Something went wrong during class setup.",
        500
      )
    );
  }
};

export const createSubjectSetup = async (req, res, next) => {
  let transaction;

  try {
    transaction = await dbConnection.transaction();
    const schoolId = req.user?.schoolId;
    const { subjects } = req.body;

    if (!schoolId) {
      await transaction.rollback();
      return next(new AppError("Authenticated school not found.", 401));
    }

    const school = await School.findByPk(schoolId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!school) {
      await transaction.rollback();
      return next(new AppError("School not found.", 404));
    }

    // Prevent duplicate subjects inside the same request
    const subjectNames = subjects.map((subject) =>
      subject.subjectName.trim().toLowerCase()
    );

    if (new Set(subjectNames).size !== subjectNames.length) {
      await transaction.rollback();
      return next(
        new AppError(
          "Duplicate subject names found in the request.",
          400
        )
      );
    }

    // Check whether any subjects already exist for the school
    const existingSubjects = await Subject.findAll({
      where: {
        schoolId,
      },
      transaction,
    });

    const existingNames = new Set(
      existingSubjects.map((subject) =>
        subject.subjectName.trim().toLowerCase()
      )
    );

    for (const subject of subjects) {
      const subjectName = subject.subjectName.trim();

      if (existingNames.has(subjectName.toLowerCase())) {
        await transaction.rollback();
        return next(
          new AppError(
            `Subject "${subjectName}" already exists.`,
            409
          )
        );
      }
    }

    const createdSubjects = await Subject.bulkCreate(
      subjects.map(
        ({ subjectName }) => ({
          schoolId,
          subjectName: subjectName.trim(),
        })
      ),
      {
        transaction,
      }
    );

    await transaction.commit();

    return res.status(201).json({
      status: "success",
      message: "Subject setup completed successfully.",
      data: createdSubjects,
    });
  } catch (err) {
    await rollbackTransaction(transaction, "CREATE_SUBJECT_SETUP_ROLLBACK_ERROR");

    if (err instanceof AppError) {
      return next(err);
    }

    if (err.name === "SequelizeUniqueConstraintError") {
      return next(
        new AppError(
          "One or more subjects already exist for this school.",
          409
        )
      );
    }

    const errorContext = {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
    };

    console.error("CREATE_SUBJECT_SETUP_ERROR:", {
      context: errorContext,
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack,
      },
    });

    return next(
      new AppError(
        isDev
          ? err.message
          : "Something went wrong during subject setup.",
        500
      )
    );
  }
};