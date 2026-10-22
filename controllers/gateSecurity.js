
import { Op } from "sequelize";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

import User from "../models/User.js";
import { dbConnection } from "../config/db.js";
import generateSecurityLoginId from "../services/generateSecurityLoginId.js";
import sendEmail from "../config/emailService.js";
import AppError from "../utils/AppError.js";

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);

const securityAttributes = [
  "id",
  "firstName",
  "surName",
  "email",
  "phoneNumber",
  "profileImageUrl",
  "loginId",
  "role",
  "status",
  "mustChangePassword",
  "profileCompleted",
  "lastLoginAt",
  "createdAt",
];

// Create a dedicated security account.
export const createSecurityPersonnel = async (req, res, next) => {
  let transaction;

  try {
    const schoolId = req.user?.schoolId;
    const { firstName, surName, email } = req.body;

    if (!schoolId) {
      return next(
        new AppError("Authenticated school not found.", 401)
      );
    }

    transaction = await dbConnection.transaction();

    // Prevent duplicate email addresses within this school.
    const existingUser = await User.findOne({
      where: {
        schoolId,
        email,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (existingUser) {
      await transaction.rollback();
      transaction = null;

      return next(
        new AppError(
          "A user with this email already exists in this school.",
          409
        )
      );
    }

    const loginId = await generateSecurityLoginId({
      schoolId,
      transaction,
    });

    const temporaryPassword = randomBytes(18).toString("base64url");

    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    const securityPersonnel = await User.create(
      {
        schoolId,
        firstName,
        surName,
        email,
        loginId,
        passwordHash,
        role: "SECURITY",
        status: "ACTIVE",
        mustChangePassword: true,
        profileCompleted: false,
      },
      { transaction }
    );

    const html = `
      <div style="
        font-family: Arial, sans-serif;
        line-height: 1.6;
        max-width: 600px;
        margin: 0 auto;
        color: #333333;
      ">
        <div style="
          background-color: #071A52;
          padding: 20px;
          text-align: center;
        ">
          <h1 style="color: #ffffff; margin: 0;">ScholaNode</h1>
        </div>

        <div style="padding: 25px;">
          <h2>Welcome to ScholaNode</h2>

          <p>Hello ${escapeHtml(firstName)},</p>

          <p>
            A security account has been created for you
            on your school's ScholaNode platform.
          </p>

          <p>Your login credentials are:</p>

          <p>
            <strong>Login ID:</strong>
            ${escapeHtml(loginId)}
          </p>

          <p>
            <strong>Temporary password:</strong>
          </p>

          <div style="
            background-color: #f1f5f9;
            padding: 16px;
            border-radius: 6px;
            word-break: break-all;
          ">
            <code>${escapeHtml(temporaryPassword)}</code>
          </div>

          <p>
            You must change your temporary password after
            your first successful login before using the
            normal application.
          </p>

          <p>Please keep your credentials private.</p>

          <p>
            Regards,<br />
            The ScholaNode Team
          </p>
        </div>
      </div>
    `;

    try {
      await sendEmail({
        to: email,
        subject: "Your ScholaNode Security Account",
        html,
      });
    } catch (emailError) {
      console.error("CREATE_SECURITY_EMAIL_ERROR:", {
        schoolId,
        error: emailError,
      });

      await transaction.rollback();
      transaction = null;

      return next(
        new AppError(
          "The account invitation email could not be sent. No account was created. Please try again.",
          500
        )
      );
    }

    await transaction.commit();
    transaction = null;

    return res.status(201).json({
      success: true,
      message:
        "Security personnel account created successfully. Login credentials have been sent by email.",
      securityPersonnel: {
        id: securityPersonnel.id,
        firstName: securityPersonnel.firstName,
        surName: securityPersonnel.surName,
        email: securityPersonnel.email,
        phoneNumber: securityPersonnel.phoneNumber,
        loginId: securityPersonnel.loginId,
        role: securityPersonnel.role,
        status: securityPersonnel.status,
        mustChangePassword: securityPersonnel.mustChangePassword,
        profileCompleted: securityPersonnel.profileCompleted,
        createdAt: securityPersonnel.createdAt,
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error(
          "CREATE_SECURITY_ROLLBACK_ERROR:",
          rollbackError
        );
      }
    }

    return next(error);
  }
};


// List security accounts belonging to the authenticated school.
export const getSecurityPersonnel = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return next(
        new AppError("Authenticated school not found.", 401)
      );
    }

    const personnel = await User.findAll({
      where: {
        schoolId,
        role: "SECURITY",
      },
      attributes: securityAttributes,
      order: [["createdAt", "DESC"]],
    });

    const summary = {
      total: personnel.length,
      active: 0,
      inactive: 0,
      suspended: 0,
    };

    for (const person of personnel) {
      if (person.status === "ACTIVE") {
        summary.active++;
      } else if (person.status === "INACTIVE") {
        summary.inactive++;
      } else if (person.status === "SUSPENDED") {
        summary.suspended++;
      }
    }

    return res.status(200).json({
      success: true,
      securityPersonnel: personnel,
      summary,
    });
  } catch (error) {
    return next(error);
  }
};


// Update permitted security account details.
export const updateSecurityPersonnel = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;
    const { securityId } = req.params;

    if (!schoolId) {
      return next(
        new AppError("Authenticated school not found.", 401)
      );
    }

    const personnel = await User.findOne({
      where: {
        id: securityId,
        schoolId,
        role: "SECURITY",
      },
    });

    if (!personnel) {
      return next(
        new AppError("Security personnel account not found.", 404)
      );
    }

    const { firstName, surName, email } = req.body;

    // Prevent assigning an email already used by another
    // account in this school.
    if (email !== undefined && email !== personnel.email) {
      const existingUser = await User.findOne({
        where: {
          schoolId,
          email,
          id: { [Op.ne]: personnel.id },
        },
      });

      if (existingUser) {
        return next(
          new AppError(
            "Another user with this email already exists in this school.",
            409
          )
        );
      }

      personnel.email = email;
    }

    if (firstName !== undefined) {
      personnel.firstName = firstName;
    }

    if (surName !== undefined) {
      personnel.surName = surName;
    }

    await personnel.save();

    return res.status(200).json({
      success: true,
      message: "Security personnel details updated successfully.",
      securityPersonnel: {
        id: personnel.id,
        firstName: personnel.firstName,
        surName: personnel.surName,
        email: personnel.email,
        phoneNumber: personnel.phoneNumber,
        profileImageUrl: personnel.profileImageUrl,
        loginId: personnel.loginId,
        role: personnel.role,
        status: personnel.status,
        lastLoginAt: personnel.lastLoginAt,
        createdAt: personnel.createdAt,
      },
    });
  } catch (error) {
    return next(error);
  }
};


// Deactivate a security account.
export const deactivateSecurityPersonnel = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;
    const { securityId } = req.params;

    if (!schoolId) {
      return next(
        new AppError("Authenticated school not found.", 401)
      );
    }

    const personnel = await User.findOne({
      where: {
        id: securityId,
        schoolId,
        role: "SECURITY",
      },
    });

    if (!personnel) {
      return next(
        new AppError("Security personnel account not found.", 404)
      );
    }

    if (personnel.status === "INACTIVE") {
      return next(
        new AppError("This security account is already inactive.", 400)
      );
    }

    personnel.status = "INACTIVE";
    await personnel.save();

    return res.status(200).json({
      success: true,
      message: "Security account deactivated successfully.",
      securityPersonnel: {
        id: personnel.id,
        firstName: personnel.firstName,
        surName: personnel.surName,
        loginId: personnel.loginId,
        role: personnel.role,
        status: personnel.status,
      },
    });
  } catch (error) {
    return next(error);
  }
};


// Reactivate an inactive security account.
export const activateSecurityPersonnel = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;
    const { securityId } = req.params;

    if (!schoolId) {
      return next(
        new AppError("Authenticated school not found.", 401)
      );
    }

    const personnel = await User.findOne({
      where: {
        id: securityId,
        schoolId,
        role: "SECURITY",
      },
    });

    if (!personnel) {
      return next(
        new AppError("Security personnel account not found.", 404)
      );
    }

    if (personnel.status === "ACTIVE") {
      return next(
        new AppError("This security account is already active.", 400)
      );
    }

    if (personnel.status === "SUSPENDED") {
      return next(
        new AppError(
          "Suspended security accounts cannot be reactivated through this endpoint.",
          403
        )
      );
    }

    personnel.status = "ACTIVE";
    await personnel.save();

    return res.status(200).json({
      success: true,
      message: "Security account reactivated successfully.",
      securityPersonnel: {
        id: personnel.id,
        firstName: personnel.firstName,
        surName: personnel.surName,
        loginId: personnel.loginId,
        role: personnel.role,
        status: personnel.status,
      },
    });
  } catch (error) {
    return next(error);
  }
};
 