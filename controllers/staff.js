import { Op } from "sequelize";
import User from "../models/User.js";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

import { dbConnection } from "../config/db.js";
import  generateStaffLoginId  from "../services/generateStaffLoginId.js";
import sendEmail  from "../config/emailService.js";


import { parse } from "csv-parse/sync";
import AppError from "../utils/AppError.js";
import { staffCsvRowSchema } from "../validation/staff.js";


const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);

// Roles that may be invited through staff management.
const INVITABLE_ROLES = [
  "LEADER",
  "VICE_LEADER",
  "ADMINISTRATOR",
  "EXAM_OFFICER",
  "STAFF",
];

const STAFF_ROLES = [
  "LEADER",
  "VICE_LEADER",
  "ADMINISTRATOR",
  "EXAM_OFFICER",
  "STAFF",
];

export const getAllStaff = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated school not found.",
      });
    }

    const staff = await User.findAll({
      where: {
        schoolId,
        role: {
          [Op.in]: STAFF_ROLES,
        },
      },
      attributes: [
        "id",
        "firstName",
        "surName",
        "email",
        "phoneNumber",
        "profileImageUrl",
        "loginId",
        "role",
        "status",
        "lastLoginAt",
        "createdAt",
      ],
      order: [["createdAt", "DESC"]],
    });

    const summary = {
      totalStaff: staff.length,
      activeStaff: 0,
      inactiveStaff: 0,
      suspendedStaff: 0,
    };

    for (const member of staff) {
      if (member.status === "ACTIVE") {
        summary.activeStaff++;
      } else if (member.status === "INACTIVE") {
        summary.inactiveStaff++;
      } else if (member.status === "SUSPENDED") {
        summary.suspendedStaff++;
      }
    }

    return res.status(200).json({
      success: true,
      staff,
      summary,
    });
  } catch (error) {
    next(error);
  }
};

export const deactivateStaff = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;
    const { staffId } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated school not found.",
      });
    }

    const staff = await User.findOne({
      where: {
        id: staffId,
        schoolId,
        role: {
          [Op.in]: STAFF_ROLES,
        },
      },
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff account not found.",
      });
    }

    if (staff.status === "INACTIVE") {
      return res.status(400).json({
        success: false,
        message: "This staff account is already inactive.",
      });
    }

    if (staff.role === "LEADER") {
      return res.status(403).json({
        success: false,
        message: "The school leader's account cannot be deactivated through staff management.",
      });
    }

    staff.status = "INACTIVE";
    await staff.save();

    return res.status(200).json({
      success: true,
      message: "Staff account deactivated successfully.",
      staff: {
        id: staff.id,
        firstName: staff.firstName,
        surName: staff.surName,
        loginId: staff.loginId,
        role: staff.role,
        status: staff.status,
      },
    });
  } catch (error) {
    next(error);
  }
};


export const activateStaff = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;
    const { staffId } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated school not found.",
      });
    }

    const staff = await User.findOne({
      where: {
        id: staffId,
        schoolId,
        role: {
          [Op.in]: STAFF_ROLES,
        },
      },
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff account not found.",
      });
    }

    if (staff.status === "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: "This staff account is already active.",
      });
    }

    if (staff.status === "SUSPENDED") {
      return res.status(403).json({
        success: false,
        message:
          "Suspended accounts cannot be reactivated through this endpoint.",
      });
    }

    staff.status = "ACTIVE";
    await staff.save();

    return res.status(200).json({
      success: true,
      message: "Staff account reactivated successfully.",
      staff: {
        id: staff.id,
        firstName: staff.firstName,
        surName: staff.surName,
        loginId: staff.loginId,
        role: staff.role,
        status: staff.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getLeaderStatus = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated school not found.",
      });
    }

    const leader = await User.findOne({
      where: {
        schoolId,
        role: "LEADER",
      },
      attributes: ["id", "status"],
    });

    return res.status(200).json({
      success: true,
      hasLeader: Boolean(leader),
      leaderStatus: leader?.status ?? null,
    });
  } catch (error) {
    next(error);
  }
};

export const updateStaff = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;
    const { staffId } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated school not found.",
      });
    }

    const staff = await User.findOne({
      where: {
        id: staffId,
        schoolId,
        role: {
          [Op.in]: STAFF_ROLES,
        },
      },
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff account not found.",
      });
    }

    if (staff.role === "LEADER") {
      return res.status(403).json({
        success: false,
        message:
          "The school leader cannot be edited through ordinary staff management.",
      });
    }

    const { firstName, surName, email, phoneNumber, role } = req.body;

    // Only update fields explicitly provided by the client.
    if (firstName !== undefined) staff.firstName = firstName;
    if (surName !== undefined) staff.surName = surName;

    if (email !== undefined) {
      staff.email = email || null;
    }

    if (phoneNumber !== undefined) {
      staff.phoneNumber = phoneNumber || null;
    }

    if (role !== undefined) {
      staff.role = role;
    }

    await staff.save();

    return res.status(200).json({
      success: true,
      message: "Staff details updated successfully.",
      staff: {
        id: staff.id,
        firstName: staff.firstName,
        surName: staff.surName,
        email: staff.email,
        phoneNumber: staff.phoneNumber,
        profileImageUrl: staff.profileImageUrl,
        loginId: staff.loginId,
        role: staff.role,
        status: staff.status,
        lastLoginAt: staff.lastLoginAt,
        createdAt: staff.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};


export const resetStaffPassword = async (req, res, next) => {
  let transaction;

  try {
    const schoolId = req.user?.schoolId;
    const { staffId } = req.params;
    const requesterRole = req.user?.role;

    // 1. Verify authenticated school
    if (!schoolId) {
      return res.status(401).json({
        status: "error",
        message: "Authenticated school not found.",
      });
    }

    // 2. Authorize the requester
    const allowedRoles = [
      "LEADER",
      "VICE_LEADER",
      "ADMINISTRATOR",
    ];

    if (!allowedRoles.includes(requesterRole)) {
      return res.status(403).json({
        status: "error",
        message: "You are not authorized to reset staff passwords.",
      });
    }

    // 3. Find staff within the authenticated school
    const staff = await User.findOne({
      where: {
        id: staffId,
        schoolId,
        role: {
          [Op.in]: STAFF_ROLES,
        },
      },
    });

    if (!staff) {
      return res.status(404).json({
        status: "error",
        message: "Staff account not found.",
      });
    }

    // The leader must use a separate account-recovery process.
    if (staff.role === "LEADER") {
      return res.status(403).json({
        status: "error",
        message:
          "The school leader's password cannot be reset through staff management.",
      });
    }

    // 4. A delivery address is required
    if (!staff.email) {
      return res.status(400).json({
        status: "error",
        message:
          "This staff member has no registered email address. Update their profile before resetting the password.",
      });
    }

    // 5. Generate a cryptographically secure temporary password
    const temporaryPassword = randomBytes(18).toString("base64url");

    // 6. Hash the temporary password
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    // 7. Prepare email
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
          <h1 style="color: #ffffff; margin: 0;">
            ScholaNode
          </h1>
        </div>

        <div style="padding: 30px; color: #333333;">
          <p>Hello ${escapeHtml(staff.firstName)},</p>

          <p>
            An authorized school administrator has initiated
            a password reset for your ScholaNode account.
          </p>

          <p>Your temporary password is:</p>

          <div style="
            background-color: #f1f5f9;
            padding: 20px;
            border-radius: 6px;
            text-align: center;
            margin: 25px 0;
          ">
            <code style="
              font-size: 20px;
              font-weight: bold;
              color: #071A52;
              word-break: break-all;
            ">${temporaryPassword}</code>
          </div>

          <p>
            Sign in using your existing Login ID and this
            temporary password. You will be required to choose
            a new password before accessing the normal
            ScholaNode dashboard.
          </p>

          <p>
            If you did not expect this change, contact your
            school administrator.
          </p>

          <p>
            Best regards,<br />
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

    // 8. Update password and send email
    transaction = await dbConnection.transaction();

    await staff.update(
      {
        passwordHash,
        mustChangePassword: true,
      },
      { transaction }
    );

    try {
      await sendEmail({
        to: staff.email,
        subject: "Your ScholaNode Temporary Password",
        html,
      });
    } catch (emailError) {
      console.error(
        "RESET_STAFF_PASSWORD_EMAIL_ERROR:",
        {
          staffId: staff.id,
          schoolId,
          error: emailError,
        }
      );

      await transaction.rollback();
      transaction = null;

      return res.status(500).json({
        status: "error",
        message:
          "Failed to send the temporary password. The password reset was not completed. Please try again.",
      });
    }

    // 9. Commit only after successful email delivery
    await transaction.commit();
    transaction = null;

    // 10. Return confirmation without revealing the password
    return res.status(200).json({
      status: "success",
      message:
        "A temporary password has been sent to the staff member's registered email.",
      data: {
        staffId: staff.id,
        loginId: staff.loginId,
        mustChangePassword: true,
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error(
          "RESET_STAFF_PASSWORD_ROLLBACK_ERROR:",
          rollbackError
        );
      }
    }

    console.error("RESET_STAFF_PASSWORD_ERROR:", {
      url: req.originalUrl,
      method: req.method,
      error,
    });

    return next(error);
  }
};




export const inviteStaff = async (req, res, next) => {
  let transaction;

  try {
    // 1. Get the authenticated school
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        success: false,
        message: "School authentication is required.",
      });
    }

    // 2. Input has already been validated by Joi middleware
    const email = req.body.email;
    const role = req.body.role;

    // 3. Start transaction
    transaction = await dbConnection.transaction();

    // 4. Prevent duplicate email invitations within this school
    const existingUser = await User.findOne({
      where: {
        schoolId,
        email,
      },
      transaction,
    });

    if (existingUser) {
      await transaction.rollback();
      transaction = null;

      return res.status(409).json({
        success: false,
        message:
          "A user with this email already exists in this school.",
      });
    }

    // 5. If inviting a principal, check whether one already exists
    if (role === "LEADER") {
      const existingLeader = await User.findOne({
        where: {
          schoolId,
          role: "LEADER",
        },
        transaction,
      });

      if (existingLeader) {
        await transaction.rollback();
        transaction = null;

        return res.status(409).json({
          success: false,
          message:
            "This school already has a principal. Only one principal is allowed per school.",
        });
      }
    }

    // 6. Generate login ID using the shared service
    const loginId = await generateStaffLoginId({
      schoolId,
      transaction,
    });

    // 7. Generate a secure temporary password
    const temporaryPassword =
      randomBytes(18).toString("base64url");

    const passwordHash = await bcrypt.hash(
      temporaryPassword,
      12
    );

    // 8. Create the invited account
    const newStaff = await User.create(
      {
        schoolId,
        firstName: "firstName",
        surName: "surName",
        email,
        loginId,
        passwordHash,
        role,
        status: "ACTIVE",
        mustChangePassword: true,
        profileCompleted: false,
      },
      { transaction }
    );

    // 9. Escape values before inserting them into HTML

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Welcome to ScholaNode</h2>

        <p>
          You have been invited to join your school on ScholaNode
          as a <strong>${escapeHtml(role)}</strong>.
        </p>

        <p>Use the credentials below to sign in:</p>

        <p>
          <strong>Login ID:</strong> ${escapeHtml(loginId)}<br />
          <strong>Temporary password:</strong>
          ${escapeHtml(temporaryPassword)}
        </p>

        <p>
          On your first login, complete your profile using your real
          first name and surname, and choose a new password before
          accessing the normal application.
        </p>

        <p>Please keep your credentials private.</p>

        <p>Regards,<br />The ScholaNode Team</p>
      </div>
    `;

    // 10. Send invitation email
    try {
      await sendEmail({
        to: email,
        subject: "Your ScholaNode Staff Account",
        html,
      });
    } catch (emailError) {
      console.error(
        "Staff invitation email failed:",
        emailError
      );

      await transaction.rollback();
      transaction = null;

      return res.status(500).json({
        success: false,
        message:
          "The invitation email could not be sent. No account was created.",
      });
    }

    // 11. Commit transaction
    await transaction.commit();
    transaction = null;

    // 12. Return safe account information
    return res.status(201).json({
      success: true,
      message:
        role === "LEADER"
          ? "Principal invitation created successfully."
          : "Staff invitation created successfully.",
      staff: {
        id: newStaff.id,
        loginId: newStaff.loginId,
        email: newStaff.email,
        role: newStaff.role,
        status: newStaff.status,
        mustChangePassword: newStaff.mustChangePassword,
        profileCompleted: newStaff.profileCompleted,
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    console.error("Invite staff error:", error);
    return next(error);
  }
};




export const importStaffCsv = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return next(
        new AppError(
          "School information is missing from your session.",
          400
        )
      );
    }

    // The request has already passed importStaffCsvSchema.
    const staff = req.body.staff;

    // 1. Reject duplicate emails within this import.
    const seenEmails = new Set();
    const duplicateEmails = new Set();

    for (const staffMember of staff) {
      const email = staffMember.email;

      if (seenEmails.has(email)) {
        duplicateEmails.add(email);
      }

      seenEmails.add(email);
    }

    if (duplicateEmails.size > 0) {
      return next(
        new AppError(
          `Duplicate emails were found in the submitted records: ${[
            ...duplicateEmails,
          ].join(", ")}. No accounts were created.`,
          400
        )
      );
    }

    // 2. Check for existing accounts in this school.
    const emails = staff.map((staffMember) => staffMember.email);

    const existingUsers = await User.findAll({
      where: {
        schoolId,
        email: {
          [Op.in]: emails,
        },
      },
      attributes: ["email"],
    });

    const existingEmails = new Set(
      existingUsers.map((user) => user.email?.toLowerCase())
    );

    const conflictingEmails = emails.filter((email) =>
      existingEmails.has(email)
    );

    if (conflictingEmails.length > 0) {
      return next(
        new AppError(
          `These emails already belong to users in this school: ${conflictingEmails.join(", ")}. No accounts were created.`,
          409
        )
      );
    }

    // 3. Create all accounts in one transaction.
    // Any account-creation failure rolls back the entire batch.
    const importedStaff = await dbConnection.transaction(
      async (transaction) => {
        const createdStaff = [];

        for (const staffMember of staff) {
          const loginId = await generateStaffLoginId({
            schoolId,
            transaction,
          });

          const temporaryPassword = randomBytes(18).toString(
            "base64url"
          );

          const passwordHash = await bcrypt.hash(
            temporaryPassword,
            12
          );

          const newStaff = await User.create(
            {
              schoolId,
              firstName: staffMember.firstName,
              surName: staffMember.surName,
              email: staffMember.email,
              role: staffMember.role,
              loginId,
              passwordHash,
              status: "ACTIVE",
              mustChangePassword: true,
              profileCompleted: false,
            },
            { transaction }
          );

          // Retain credentials only in memory for email delivery.
          createdStaff.push({
            id: newStaff.id,
            firstName: newStaff.firstName,
            email: newStaff.email,
            role: newStaff.role,
            loginId: newStaff.loginId,
            temporaryPassword,
          });
        }

        return createdStaff;
      }
    );

    // 4. Accounts are committed. Email failures must not roll them back.
    const emailFailures = [];
    let emailsSent = 0;

    for (const staffMember of importedStaff) {
      const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Welcome to ScholaNode</h2>

          <p>Hello ${escapeHtml(staffMember.firstName)},</p>

          <p>Your staff account has been created.</p>

          <p>
            <strong>Role:</strong>
            ${escapeHtml(staffMember.role.replaceAll("_", " "))}
          </p>

          <p>
            <strong>Login ID:</strong>
            ${escapeHtml(staffMember.loginId)}
          </p>

          <p>
            <strong>Temporary password:</strong>
            ${escapeHtml(staffMember.temporaryPassword)}
          </p>

          <p>
            Sign in using these credentials. You will be required
            to change your temporary password.
          </p>

          <p>Please keep your credentials private.</p>

          <p>Regards,<br />The ScholaNode Team</p>
        </div>
      `;

      try {
        await sendEmail({
          to: staffMember.email,
          subject: "Your ScholaNode Staff Account",
          html,
        });

        emailsSent += 1;
      } catch (emailError) {
        console.error("STAFF_IMPORT_EMAIL_ERROR:", {
          staffId: staffMember.id,
          schoolId,
          error: emailError,
        });

        emailFailures.push({
          staffId: staffMember.id,
          email: staffMember.email,
          message: "Invitation email could not be sent.",
        });
      }
    }

    // 5. Return safe account details without temporary passwords.
    return res.status(201).json({
      success: true,
      message:
        emailFailures.length > 0
          ? "Staff accounts were created, but some invitation emails failed."
          : "Staff accounts were created and invitation emails were sent successfully.",
      data: {
        totalImported: importedStaff.length,
        emailsSent,
        emailFailureCount: emailFailures.length,
        emailFailures,
        staff: importedStaff.map((staffMember) => ({
          id: staffMember.id,
          firstName: staffMember.firstName,
          email: staffMember.email,
          role: staffMember.role,
          loginId: staffMember.loginId,
          status: "ACTIVE",
          mustChangePassword: true,
          profileCompleted: false,
        })),
      },
    });
  } catch (error) {
    return next(error);
  }
};

