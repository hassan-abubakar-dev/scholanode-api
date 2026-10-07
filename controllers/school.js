/**
 * @file controllers/school.js
 * @description Controller for school registration and management
 */

import bcrypt from 'bcryptjs';
import School from '../models/School.js';
import User from '../models/User.js';
import Session from "../models/Session.js";
import Term from "../models/Term.js";
import Owner from "../models/Owner.js";
import VerificationCode from "../models/VerificationCode.js";
import sendEmail from '../config/emailService.js';

import { Op } from 'sequelize';

import { dbConnection } from "../config/db.js";

import pricingConfig from '../config/pricing.js';
import AppError from '../utils/AppError.js';
import generateExpiryTime from '../utils/experyTime.js';
import generateVerificationCode from '../utils/verificationCode.js';

const isDev = process.env.NODE_ENV !== "production";


export const checkSchoolCode = async (req, res, next) => {
  try {
    const schoolCode = req.query.schoolCode?.trim();
    console.log('Checking school code availability:', schoolCode);

    if (!schoolCode) {
      return res.status(400).json({
        status: 'error',
        message: 'schoolCode is required.',
      });
    }

    const school = await School.findOne({ where: { schoolCode } });

    return res.status(200).json({
      status: 'success',
      schoolCode,
      available: !school,
    });
  } catch (error) {
    console.error('Check school code error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to check school code.',
    });
  }
};

/**
 * Register a new school with admin user and plan
 * Request body: { school, admin, plan }
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const registerSchool = async (req, res, next) => {
  const transaction = await dbConnection.transaction();

  try {
    const {
      school: schoolData,
      admin: adminData,
      plan: planData,
    } = req.body;

    console.log('School data:', schoolData);
    console.log('Admin data:', adminData);
    console.log('Plan data:', planData);

    // =========================================================
    // 1. BASIC REQUEST VALIDATION
    // =========================================================

    if (!schoolData || !adminData || !planData) {
      await transaction.rollback();

      return res.status(400).json({
        status: "error",
        message:
          "Missing required fields: school, admin, and plan are required.",
      });
    }

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
    // 2. VALIDATE SCHOOL FIELDS
    // =========================================================

    if (
      !schoolName ||
      !schoolCode ||
      !address ||
      !schoolLevel ||
      !ownershipType
    ) {
      await transaction.rollback();

      return res.status(400).json({
        status: "error",
        message:
          "Missing required school fields: schoolName, schoolCode, address, schoolLevel, ownershipType",
      });
    }

    // =========================================================
    // 3. VALIDATE USER FIELDS
    // =========================================================

    if (!firstName || !surName || !userEmail || !password || !role) {
      await transaction.rollback();

      return res.status(400).json({
        status: "error",
        message:
          "Missing required user fields: firstName, surName, email, password, role",
      });
    }

    // =========================================================
    // 4. NORMALIZE VALUES
    // =========================================================

    const normalizedSchoolName = schoolName.trim();
    const normalizedSchoolCode = schoolCode.trim().toUpperCase();
    const normalizedUserEmail = userEmail.trim().toLowerCase();
    const normalizedAddress = address.trim();

    const normalizedSchoolLevel = schoolLevel.trim().toUpperCase();
    const normalizedOwnershipType = ownershipType.trim().toUpperCase();
    const normalizedRole = role.trim().toUpperCase();
    const roleAliases = {
      VICE_LEADER: "VICE",
    };
    const databaseRole = roleAliases[normalizedRole] || normalizedRole;
    const normalizedPlan = plan?.trim().toUpperCase();

    // =========================================================
    // 5. VALIDATE SCHOOL LEVEL
    // =========================================================

    const allowedSchoolLevels = [
      "PRIMARY",
      "SECONDARY",
      "COMBINED",
    ];

    if (!allowedSchoolLevels.includes(normalizedSchoolLevel)) {
      await transaction.rollback();

      return res.status(400).json({
        status: "error",
        message:
          "Invalid school level. Allowed values: PRIMARY, SECONDARY, COMBINED.",
      });
    }

    // =========================================================
    // 6. VALIDATE OWNERSHIP TYPE
    // =========================================================

    const allowedOwnershipTypes = [
      "GOVERNMENT",
      "PRIVATE",
    ];

    if (!allowedOwnershipTypes.includes(normalizedOwnershipType)) {
      await transaction.rollback();

      return res.status(400).json({
        status: "error",
        message:
          "Invalid ownership type. Allowed values: GOVERNMENT, PRIVATE.",
      });
    }

    // =========================================================
    // 7. VALIDATE PLAN
    // =========================================================

    if (!normalizedPlan) {
      await transaction.rollback();

      return res.status(400).json({
        status: "error",
        message: "Plan is required.",
      });
    }

    if (!pricingConfig[normalizedPlan]) {
      await transaction.rollback();

      return res.status(400).json({
        status: "error",
        message: `Invalid plan. Available plans: ${Object.keys(
          pricingConfig
        ).join(", ")}`,
      });
    }

    // =========================================================
    // 8. VALIDATE TIER / BILLING CYCLE
    // =========================================================

    let planPrice = null;

    if (tierId && billingCycle) {
      const planTiers = pricingConfig[normalizedPlan];

      const tier = planTiers.find(
        (item) => item.id === tierId
      );

      if (!tier) {
        await transaction.rollback();

        return res.status(400).json({
          status: "error",
          message: `Invalid tier ID for plan ${normalizedPlan}`,
        });
      }

      const normalizedBillingCycle =
        billingCycle.trim().toUpperCase();

      const pricing = tier[normalizedBillingCycle];

      if (!pricing) {
        await transaction.rollback();

        return res.status(400).json({
          status: "error",
          message: `Billing cycle ${billingCycle} is not available for tier ${tierId}`,
        });
      }

      planPrice = pricing.price;
    }

    // =========================================================
    // 9. FIND AN UNFINISHED REGISTRATION
    // =========================================================
    //
    // Our rule:
    //
    // Same school name
    // + same address
    // + PENDING_VERIFICATION
    //
    // = unfinished registration that can be replaced.
    //
    // We deliberately do NOT destroy ACTIVE,
    // PENDING_ACTIVATION or SUSPENDED schools.
    // =========================================================

    const pendingSchool = await School.findOne({
      where: {
        schoolName: normalizedSchoolName,
        address: normalizedAddress,
        status: "PENDING_VERIFICATION",
      },
      transaction,
    });

    if (pendingSchool) {
      // -------------------------------------------------------
      // Find owners belonging to this pending school
      // -------------------------------------------------------

      const existingOwner = await Owner.findOne({
        where: {
          schoolId: pendingSchool.id,
        },
        transaction,
      });

      const existingUserId = existingOwner?.userId;

      // -------------------------------------------------------
      // Delete verification codes belonging to old users
      // -------------------------------------------------------

      if (existingUserId) {
        const existingUser = await User.findByPk(existingUserId, {
          transaction,
        });

        if (existingUser?.email) {
          await VerificationCode.destroy({
            where: {
              userEmail: existingUser.email,
            },
            transaction,
          });
        }
      }

      // -------------------------------------------------------
      // Delete Owner relationships
      // -------------------------------------------------------

      await Owner.destroy({
        where: {
          schoolId: pendingSchool.id,
        },
        transaction,
      });

      // -------------------------------------------------------
      // Delete users belonging to the old registration
      // -------------------------------------------------------

      if (existingUserId) {
        await User.destroy({
          where: {
            id: existingUserId,
          },
          transaction,
        });
      }

      // -------------------------------------------------------
      // Delete the old pending school
      // -------------------------------------------------------

      await pendingSchool.destroy({
        transaction,
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

        // Registration has not yet been verified.
        status: "PENDING_VERIFICATION",

        // Keep this false until the school becomes active.
        isActive: false,
      },
      {
        transaction,
      }
    );

    // =========================================================
    // 13. GENERATE LOGIN ID
    // =========================================================
    //
    // Format:
    //
    // ABC/STF/0001
    //
    // First 3 characters of school code
    // + STF
    // + 4-digit serial number
    //
    // Since this is the first user for a newly-created school,
    // the serial will normally be 0001.
    //
    // We still calculate it from the school's existing users so
    // the same approach can be reused when creating staff later.
    // =========================================================

    const staffCount = await User.count({
      where: {
        schoolId: newSchool.id,
      },
      transaction,
    });

    const serialNumber = String(staffCount + 1).padStart(
      4,
      "0"
    );

    const loginId =
      `${normalizedSchoolCode.substring(0, 3)}/STF/${serialNumber}`;

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
      },
      {
        transaction,
      }
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
            Hello ${firstName},
          </p>

          <p style="
            font-size: 16px;
            line-height: 1.6;
          ">
            Thank you for registering
            <strong>${normalizedSchoolName}</strong>
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
              ${verificationCode}
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
              ${loginId}
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
            This verification code will expire shortly.
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

    // =========================================================
    // 19. EMAIL MUST SUCCEED BEFORE COMMIT
    // =========================================================

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
          email: normalizedUserEmail,
          schoolId: newSchool.id,
          error: emailError,
        }
      );

      await transaction.rollback();

      return res.status(500).json({
        status: "error",
        message:
          "Failed to send verification email. Please try again.",
      });
    }

    // =========================================================
    // 20. COMMIT
    // =========================================================

    await transaction.commit();

    // =========================================================
    // 21. RESPONSE
    // =========================================================

    return res.status(201).json({
      status: "success",
      message:
        `Registration successful. A verification code has been sent to ${normalizedUserEmail}.`,

      data: {
        school: {
          id: newSchool.id,
          schoolName: newSchool.schoolName,
          schoolCode: newSchool.schoolCode,
          schoolLevel: newSchool.schoolLevel,
          ownershipType: newSchool.ownershipType,
          status: newSchool.status,
          isActive: newSchool.isActive,
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
          tierId: tierId || null,
          billingCycle: billingCycle || null,
          price: planPrice || "FREE",
        },
      },
    });
  } catch (error) {
    // =========================================================
    // UNEXPECTED ERROR
    // =========================================================

    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error(
        "REGISTER_SCHOOL_ROLLBACK_ERROR:",
        rollbackError
      );
    }

    console.error("REGISTER_SCHOOL_ERROR:", {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      error,
    });

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

    const logoCompleted = Boolean(
      school.logoUrl?.trim()
    );

    const welcomeMessageCompleted = Boolean(
      school.welcomeMessage?.trim()
    );

    const websiteCompleted = Boolean(
      school.website?.trim()
    );

    // 4. Calculate progress
    const completedSteps = [
      supportEmailCompleted,
      supportPhoneCompleted,
      logoCompleted,
      welcomeMessageCompleted,
      websiteCompleted,
    ].filter(Boolean).length;

    const totalSteps = 5;

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
          website: websiteCompleted,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Get school details by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getSchoolByCode = async (req, res) => {
  try {
    const { code } = req.params;

    if (!code?.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'School code is required.',
      });
    }

    const school = await School.findOne({
      where: {
        schoolCode: code.trim().toUpperCase(),
        status: {
          [Op.in]: ['ACTIVE', 'PENDING_ACTIVATION'],
        },
      },
    });

    if (!school) {
      return res.status(404).json({
        status: 'error',
        message: 'School not found.',
      });
    }

    return res.status(200).json({
      status: 'success',
      data: school,
    });
  } catch (error) {
    console.error('Get school by code error:', error);

    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch school.',
    });
  }
};


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

    const school = await School.findByPk(schoolId);

    if (!school) {
      return next(
        new AppError(
          "School not found.",
          404
        )
      );
    }

    return res.status(200).json({
      success: true,
      school,
    });
  } catch (error) {
    next(error);
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
    const { schoolId } = req.user;

    const {
      logoUrl,
      logoPublicId,
      welcomeMessage,
      loginInstructions,
      registrationGuidelines,
      supportEmail,
      supportPhone,
      website,
    } = req.body;

    const updates = {
      logoUrl,
      logoPublicId,
      welcomeMessage,
      loginInstructions,
      registrationGuidelines,
      supportEmail,
      supportPhone,
      website,
    };

    // Remove fields that were not provided in the request
    Object.keys(updates).forEach((key) => {
      if (updates[key] === undefined) {
        delete updates[key];
      }
    });

    if (Object.keys(updates).length === 0) {
      return next(
        new AppError(
          "No school setup fields provided for update.",
          400
        )
      );
    }

    const school = await School.findByPk(schoolId);

    if (!school) {
      return next(new AppError("School not found.", 404));
    }

    await school.update(updates);

    return res.status(200).json({
      status: "success",
      message: "School setup updated successfully.",
      data: school,
    });
  } catch (err) {
    const errorContext = {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
    };

    console.error("UPDATE_SCHOOL_SETUP_ERROR:", {
      context: errorContext,
      error: err,
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



export const createAcademicSetup = async (req, res, next) => {
  const transaction = await dbConnection.transaction();

  try {
    const { id } = req.params;
    const { session, terms } = req.body;

    // 1. Check that the school exists
    const school = await School.findByPk(id, {
      transaction,
    });

    if (!school) {
      await transaction.rollback();
      return next(new AppError("School not found.", 404));
    }

    // 2. Validate session data
    if (!session?.sessionName || !session?.startDate || !session?.endDate) {
      await transaction.rollback();
      return next(
        new AppError(
          "Session name, start date and end date are required.",
          400
        )
      );
    }

    // 3. Validate session dates
    if (new Date(session.endDate) <= new Date(session.startDate)) {
      await transaction.rollback();
      return next(
        new AppError("Session end date must be after the start date.", 400)
      );
    }

    // 4. Validate terms
    if (!Array.isArray(terms) || terms.length === 0) {
      await transaction.rollback();
      return next(
        new AppError("At least one term is required.", 400)
      );
    }

    // 5. Check that every term has the required information
    for (const term of terms) {
      if (!term.termName || !term.startDate || !term.endDate) {
        await transaction.rollback();
        return next(
          new AppError(
            "Every term must have a name, start date and end date.",
            400
          )
        );
      }

      if (new Date(term.endDate) <= new Date(term.startDate)) {
        await transaction.rollback();
        return next(
          new AppError(
            `${term.termName} end date must be after its start date.`,
            400
          )
        );
      }

      // Term must fall inside the session
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

    // 6. Check for an existing session with the same name
    const existingSession = await Session.findOne({
      where: {
        schoolId: id,
        sessionName: session.sessionName,
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
        schoolId: id,
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
      terms.map((term) => ({
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
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    const errorContext = {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
    };

    console.error("CREATE_SCHOOL_ONBOARDING_ERROR:", {
      context: errorContext,
      error: err,
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
  const transaction = await dbConnection.transaction();

  try {
    const { id: schoolId } = req.params;
    const { classes } = req.body;

    const school = await School.findByPk(schoolId, {
      transaction,
    });

    if (!school) {
      await transaction.rollback();
      return next(new AppError("School not found.", 404));
    }

    if (!Array.isArray(classes) || classes.length === 0) {
      await transaction.rollback();
      return next(
        new AppError("At least one class is required.", 400)
      );
    }

    const validCategories = [
      "PRIMARY",
      "JUNIOR_SECONDARY",
      "SENIOR_SECONDARY",
    ];

    // Validate all classes before creating anything
    for (const classItem of classes) {
      const { classCategory, classLevel, arm } = classItem;

      if (!classCategory || !classLevel || !arm) {
        await transaction.rollback();
        return next(
          new AppError(
            "Each class must have a category, level, and arm.",
            400
          )
        );
      }

      if (!validCategories.includes(classCategory)) {
        await transaction.rollback();
        return next(
          new AppError(
            `Invalid class category: ${classCategory}.`,
            400
          )
        );
      }
    }

    // Prevent duplicates inside the same request
    const classKeys = classes.map(
      ({ classLevel, arm }) =>
        `${classLevel.trim().toLowerCase()}::${arm.trim().toLowerCase()}`
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
    });

    const existingKeys = new Set(
      existingClasses.map(
        ({ classLevel, arm }) =>
          `${classLevel.trim().toLowerCase()}::${arm.trim().toLowerCase()}`
      )
    );

    for (const classItem of classes) {
      const key = `${classItem.classLevel.trim().toLowerCase()}::${classItem.arm
        .trim()
        .toLowerCase()}`;

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

    const createdClasses = await Class.bulkCreate(
      classes.map(({ classCategory, classLevel, arm }) => ({
        schoolId,
        classCategory: classCategory.trim(),
        classLevel: classLevel.trim(),
        arm: arm.trim(),
      })),
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
    await transaction.rollback();

    const errorContext = {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
    };

    console.error("CREATE_CLASS_SETUP_ERROR:", {
      context: errorContext,
      error: err,
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
  const transaction = await dbConnection.transaction();

  try {
    const { id: schoolId } = req.params;
    const { subjects } = req.body;

    const school = await School.findByPk(schoolId, {
      transaction,
    });

    if (!school) {
      await transaction.rollback();
      return next(new AppError("School not found.", 404));
    }

    if (!Array.isArray(subjects) || subjects.length === 0) {
      await transaction.rollback();
      return next(
        new AppError("At least one subject is required.", 400)
      );
    }

    // Validate all subjects before creating anything
    for (const subject of subjects) {
      const { subjectName } = subject;

      if (!subjectName || !subjectName.trim()) {
        await transaction.rollback();
        return next(
          new AppError("Each subject must have a subject name.", 400)
        );
      }
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
        ({ subjectName, subjectCode, category }) => ({
          schoolId,
          subjectName: subjectName.trim(),
          subjectCode: subjectCode?.trim() || null,
          category: category?.trim() || null,
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
    await transaction.rollback();

    const errorContext = {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
    };

    console.error("CREATE_SUBJECT_SETUP_ERROR:", {
      context: errorContext,
      error: err,
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