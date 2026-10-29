import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

import { dbConnection } from "../config/db.js";

import { Op } from "sequelize";

import {
  School,
  User,
  Parent,
  ParentStudent,
  Student,
  Class,
  Session,
  Term,
  AttendanceRegister,
  AttendanceRecord,
} from "../relationships/associations.js";

import AppError from '../utils/AppError.js';
import sendEmail from '../config/emailService.js';
import VerificationCode from "../models/VerificationCode.js";
import generateVerificationCode from "../utils/verificationCode.js";
import generateExpiryTime from "../utils/experyTime.js";

const isDev = process.env.NODE_ENV === "development";


// Also import sendEmail, AppError, and isDev from
// the same existing project modules used by your other controllers.

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);



  const CHILD_EMAIL_CHANGE_PURPOSE = "PROFILE_EMAIL_CHANGE";

const getParentAndLinkedChild = async ({
  parentUserId,
  schoolId,
  studentId,
  transaction,
}) => {
  // Confirm the authenticated user has an active Parent profile.
  const parent = await Parent.findOne({
    where: {
      userId: parentUserId,
      schoolId,
      status: "ACTIVE",
    },
    include: [
      {
        model: User,
        as: "user",
        required: true,
        where: {
          id: parentUserId,
          schoolId,
          role: "PARENT",
          status: "ACTIVE",
        },
      },
    ],
    transaction,
    ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
  });

  if (!parent) {
    throw new AppError("Active parent account not found.", 403);
  }

  // Confirm the child belongs to the same school and is linked
  // to this exact parent.
  const relationship = await ParentStudent.findOne({
    where: {
      schoolId,
      parentId: parent.id,
      studentId,
    },
    include: [
      {
        model: Student,
        as: "student",
        required: true,
        where: { schoolId },
        include: [
          {
            model: User,
            as: "user",
            required: true,
            where: {
              schoolId,
              role: "STUDENT",
            },
          },
        ],
      },
    ],
    transaction,
    ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
  });

  if (!relationship?.student?.user) {
    throw new AppError(
      "The selected student is not linked to your parent account.",
      404
    );
  }

  return {
    parent,
    parentUser: parent.user,
    student: relationship.student,
    childUser: relationship.student.user,
  };
};



export const createParent = async (req, res, next) => {
  let transaction;

  try {
    // 1. Get the authenticated school.
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        success: false,
        message: "School authentication is required.",
      });
    }

    // 2. Read validated request data.
    const {
      firstName,
      surName,
      phoneNumber,
      email,
      student,
    } = req.body;

    // The parent's phone number is their Login ID.
    const loginId = phoneNumber.trim();
    const normalizedEmail = email.trim().toLowerCase();

    // 3. Start the transaction.
    transaction = await dbConnection.transaction();

    // 4. Prevent duplicate Login IDs within the school.
    const existingUser = await User.findOne({
      where: {
        schoolId,
        loginId,
      },
      transaction,
    });

    if (existingUser) {
      await transaction.rollback();
      transaction = null;

      if (existingUser.role === "PARENT") {
        return res.status(409).json({
          success: false,
          code: "PARENT_ACCOUNT_EXISTS",
          message:
            "An account already uses this phone number. Confirm the parent's identity before reusing an existing account.",
        });
      }

      return res.status(409).json({
        success: false,
        code: "LOGIN_ID_ALREADY_USED",
        message:
          "This phone number is already used as a Login ID by another account in this school.",
      });
    }

    // 5. Verify the optional student belongs to this school.
    let linkedStudent = null;

    if (student) {
      linkedStudent = await Student.findOne({
        where: {
          id: student.studentId,
          schoolId,
        },
        transaction,
      });

      if (!linkedStudent) {
        await transaction.rollback();
        transaction = null;

        return res.status(404).json({
          success: false,
          message:
            "Student not found in your school. No parent account was created.",
        });
      }
    }

    // 6. Generate temporary credentials.
    const temporaryPassword =
      randomBytes(18).toString("base64url");

    const passwordHash = await bcrypt.hash(
      temporaryPassword,
      12
    );

    // 7. Create the User account.
    const user = await User.create(
      {
        schoolId,
        firstName,
        surName,
        phoneNumber: loginId,
        email: normalizedEmail,
        loginId,
        passwordHash,
        role: "PARENT",
        status: "ACTIVE",
        mustChangePassword: true,
        profileCompleted: false,
      },
      { transaction }
    );

    // 8. Create the Parent profile.
    const parent = await Parent.create(
      {
        schoolId,
        userId: user.id,
        status: "ACTIVE",
      },
      { transaction }
    );

    // 9. Create the optional student relationship.
    let parentStudentLink = null;

    if (linkedStudent) {
      parentStudentLink = await ParentStudent.create(
        {
          schoolId,
          parentId: parent.id,
          studentId: linkedStudent.id,
          relationship: student.relationship,
          // receivesNotifications defaults to true in the model.
        },
        { transaction }
      );
    }

    // 10. Get the school information for the invitation.
    const school = await School.findByPk(schoolId, {
      transaction,
    });

    if (!school) {
      throw new AppError(
        "The school associated with this account could not be found.",
        500
      );
    }

    // 11. Prepare the invitation email.
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
          <h1 style="color: #ffffff; margin: 0;">
            ScholaNode
          </h1>
        </div>

        <div style="padding: 25px;">
          <h2>Welcome to ScholaNode</h2>

          <p>Hello ${escapeHtml(firstName)},</p>

          <p>
            Your parent account has been created for
            <strong>${escapeHtml(school.schoolName)}</strong>.
          </p>

          <p>Use the credentials below to sign in:</p>

          <div style="
            background-color: #f8fafc;
            padding: 20px;
            border-radius: 8px;
          ">
            <p>
              <strong>Login ID:</strong>
              ${escapeHtml(loginId)}
            </p>

            <p>
              <strong>Temporary password:</strong>
              ${escapeHtml(temporaryPassword)}
            </p>
          </div>

          <p>
            Your phone number is your Login ID.
            Enter it together with the temporary password
            when signing in.
          </p>

          <p>
            You must change your temporary password
            when you first log in.
          </p>

          <p>Please keep your login credentials private.</p>

          <p>
            Regards,<br />
            The ScholaNode Team
          </p>
        </div>

        <div style="
          background-color: #f9f9f9;
          padding: 15px;
          text-align: center;
          font-size: 12px;
          color: #777777;
        ">
          &copy; ${new Date().getFullYear()} ScholaNode.
          All rights reserved.
        </div>
      </div>
    `;

    // 12. Send invitation before committing.
    try {
      await sendEmail({
        to: normalizedEmail,
        subject: "Your ScholaNode Parent Account",
        html,
      });
    } catch (emailError) {
      console.error("CREATE_PARENT_EMAIL_ERROR:", {
        schoolId,
        userId: user.id,
        error: emailError,
      });

      await transaction.rollback();
      transaction = null;

      return next(
        new AppError(
          isDev
            ? emailError.message
            : "The parent invitation email could not be sent. No account was created. Please try again.",
          500
        )
      );
    }

    // 13. Commit after the invitation succeeds.
    await transaction.commit();
    transaction = null;

    // 14. Return safe account information.
    return res.status(201).json({
      success: true,
      message: linkedStudent
        ? "Parent account created, invitation emailed, and student linked successfully."
        : "Parent account created and invitation emailed successfully.",

      invitationEmailSent: true,

      parent: {
        id: parent.id,
        userId: user.id,
        firstName: user.firstName,
        surName: user.surName,
        phoneNumber: user.phoneNumber,
        email: user.email,
        loginId: user.loginId,
        status: parent.status,
        profileCompleted: user.profileCompleted,
      },

      studentRelationship: parentStudentLink
        ? {
            id: parentStudentLink.id,
            studentId: parentStudentLink.studentId,
            relationship: parentStudentLink.relationship,
            receivesNotifications:
              parentStudentLink.receivesNotifications,
          }
        : null,
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error(
          "CREATE_PARENT_ROLLBACK_ERROR:",
          rollbackError
        );
      }
    }

    console.error("CREATE_PARENT_ERROR:", {
      schoolId: req.user?.schoolId,
      error,
    });

    return next(
      error instanceof AppError
        ? error
        : new AppError(
            isDev
              ? error.message
              : "Unable to create the parent account. Please try again.",
            500
          )
    );
  }
};


export const importParents = async (req, res, next) => {
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

    // The request has already passed importParentsSchema.
    const parents = req.body.parents;

    // Normalize values consistently for duplicate detection.
    for (const parent of parents) {
      parent.firstName = parent.firstName.trim();
      parent.surName = parent.surName.trim();
      parent.phoneNumber = parent.phoneNumber.trim();
      parent.email = parent.email.trim().toLowerCase();
    }

    // 1. Reject duplicate emails and phone numbers within the batch.
    const seenEmails = new Set();
    const duplicateEmails = new Set();

    const seenPhoneNumbers = new Set();
    const duplicatePhoneNumbers = new Set();

    for (const parent of parents) {
      if (seenEmails.has(parent.email)) {
        duplicateEmails.add(parent.email);
      }

      seenEmails.add(parent.email);

      if (seenPhoneNumbers.has(parent.phoneNumber)) {
        duplicatePhoneNumbers.add(parent.phoneNumber);
      }

      seenPhoneNumbers.add(parent.phoneNumber);
    }

    if (
      duplicateEmails.size > 0 ||
      duplicatePhoneNumbers.size > 0
    ) {
      const details = [];

      if (duplicateEmails.size > 0) {
        details.push(
          `Duplicate emails: ${[...duplicateEmails].join(", ")}`
        );
      }

      if (duplicatePhoneNumbers.size > 0) {
        details.push(
          `Duplicate phone numbers: ${
            [...duplicatePhoneNumbers].join(", ")
          }`
        );
      }

      return next(
        new AppError(
          `${details.join(". ")}. No parent accounts were created.`,
          400
        )
      );
    }

    // 2. Check existing accounts in this school.
    // Parent phone numbers are also their User login IDs.
    const emails = parents.map((parent) => parent.email);
    const phoneNumbers = parents.map(
      (parent) => parent.phoneNumber
    );

    const existingUsers = await User.findAll({
      where: {
        schoolId,
        [Op.or]: [
          {
            email: {
              [Op.in]: emails,
            },
          },
          {
            loginId: {
              [Op.in]: phoneNumbers,
            },
          },
        ],
      },
      attributes: ["email", "loginId"],
    });

    const existingEmails = new Set(
      existingUsers
        .map((user) => user.email?.toLowerCase())
        .filter(Boolean)
    );

    const existingLoginIds = new Set(
      existingUsers
        .map((user) => user.loginId)
        .filter(Boolean)
    );

    const conflictingEmails = emails.filter((email) =>
      existingEmails.has(email)
    );

    const conflictingPhoneNumbers = phoneNumbers.filter(
      (phoneNumber) => existingLoginIds.has(phoneNumber)
    );

    if (
      conflictingEmails.length > 0 ||
      conflictingPhoneNumbers.length > 0
    ) {
      const details = [];

      if (conflictingEmails.length > 0) {
        details.push(
          `Emails already in use: ${
            [...new Set(conflictingEmails)].join(", ")
          }`
        );
      }

      if (conflictingPhoneNumbers.length > 0) {
        details.push(
          `Phone numbers already in use as login IDs: ${
            [...new Set(conflictingPhoneNumbers)].join(", ")
          }`
        );
      }

      return next(
        new AppError(
          `${details.join(". ")}. No parent accounts were created.`,
          409
        )
      );
    }

    // 3. Create all User and Parent records in one transaction.
    const importedParents = await dbConnection.transaction(
      async (transaction) => {
        const createdParents = [];

        for (const parentData of parents) {
          const temporaryPassword = randomBytes(18).toString(
            "base64url"
          );

          const passwordHash = await bcrypt.hash(
            temporaryPassword,
            12
          );

          const user = await User.create(
            {
              schoolId,
              firstName: parentData.firstName,
              surName: parentData.surName,
              phoneNumber: parentData.phoneNumber,
              email: parentData.email,
              loginId: parentData.phoneNumber,
              passwordHash,
              role: "PARENT",
              status: "ACTIVE",
              mustChangePassword: true,
              profileCompleted: false,
            },
            { transaction }
          );

          const parent = await Parent.create(
            {
              schoolId,
              userId: user.id,
              status: "ACTIVE",
            },
            { transaction }
          );

          // Retain temporary credentials only for email delivery.
          createdParents.push({
            id: parent.id,
            userId: user.id,
            firstName: user.firstName,
            surName: user.surName,
            email: user.email,
            phoneNumber: user.phoneNumber,
            loginId: user.loginId,
            status: user.status,
            temporaryPassword,
          });
        }

        return createdParents;
      }
    );

    // 4. Send invitations after commit.
    // Email failures do not roll back created accounts.
    const emailFailures = [];
    let emailsSent = 0;

    for (const parent of importedParents) {
      const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Welcome to ScholaNode</h2>

          <p>Hello ${escapeHtml(parent.firstName)},</p>

          <p>Your parent account has been created.</p>

          <p>
            <strong>Login ID:</strong>
            ${escapeHtml(parent.loginId)}
          </p>

          <p>
            <strong>Temporary password:</strong>
            ${escapeHtml(parent.temporaryPassword)}
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
          to: parent.email,
          subject: "Your ScholaNode Parent Account",
          html,
        });

        emailsSent += 1;
      } catch (emailError) {
        console.error("PARENT_IMPORT_EMAIL_ERROR:", {
          parentId: parent.id,
          schoolId,
          error: emailError,
        });

        emailFailures.push({
          parentId: parent.id,
          email: parent.email,
          message: "Invitation email could not be sent.",
        });
      }
    }

    // 5. Return safe account details without temporary passwords.
    return res.status(201).json({
      success: true,
      message:
        emailFailures.length > 0
          ? "Parent accounts were created, but some invitation emails failed."
          : "Parent accounts were created and invitation emails were sent successfully.",
      data: {
        totalImported: importedParents.length,
        emailsSent,
        emailFailureCount: emailFailures.length,
        emailFailures,
        parents: importedParents.map((parent) => ({
          id: parent.id,
          userId: parent.userId,
          firstName: parent.firstName,
          surName: parent.surName,
          email: parent.email,
          phoneNumber: parent.phoneNumber,
          loginId: parent.loginId,
          status: parent.status,
          mustChangePassword: true,
          profileCompleted: false,
        })),
      },
    });
  } catch (error) {
    return next(error);
  }
};



export const getAllParents = async (req, res, next) => {
  try {
    // 1. Get the authenticated school.
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        success: false,
        message: "School authentication is required.",
      });
    }

    // 2. Read validated query parameters.
    const {
      search = "",
      status = "ALL",
      relationship = "ALL",
    } = req.query;

    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const offset = (page - 1) * limit;

    // 3. Build the parent filters.
    const parentWhere = { schoolId };

    if (status !== "ALL") {
      parentWhere.status = status;
    }

    // 4. Configure student relationship filtering.
    const relationshipInclude = {
      model: ParentStudent,
      as: "studentRelationships",
      attributes: [],
      required: relationship !== "ALL",
      ...(relationship !== "ALL"
        ? { where: { relationship } }
        : {}),
      include: [
        {
          model: Student,
          as: "student",
          attributes: [],
          required: false,
          include: [
            {
              model: User,
              as: "user",
              attributes: [],
              required: false,
            },
          ],
        },
      ],
    };

    // 5. Add search across parent and student information.
    const searchTerm = search.trim();

    if (searchTerm) {
      const pattern = `%${searchTerm}%`;

      parentWhere[Op.or] = [
        { "$user.firstName$": { [Op.iLike]: pattern } },
        { "$user.surName$": { [Op.iLike]: pattern } },
        { "$user.phoneNumber$": { [Op.iLike]: pattern } },
        { "$user.email$": { [Op.iLike]: pattern } },
        { "$user.loginId$": { [Op.iLike]: pattern } },
        {
          "$studentRelationships.student.admissionNumber$": {
            [Op.iLike]: pattern,
          },
        },
        {
          "$studentRelationships.student.user.firstName$": {
            [Op.iLike]: pattern,
          },
        },
        {
          "$studentRelationships.student.user.surName$": {
            [Op.iLike]: pattern,
          },
        },
      ];
    }

    // 6. Find matching parents and paginate their IDs.
    const result = await Parent.findAndCountAll({
      where: parentWhere,

      attributes: ["id"],

      include: [
        {
          model: User,
          as: "user",
          attributes: [],
          required: true,
        },
        relationshipInclude,
      ],

      distinct: true,
      col: "id",
      subQuery: false,

      limit,
      offset,

      order: [
        ["createdAt", "DESC"],
        ["id", "ASC"],
      ],
    });

    const total = result.count;

    if (result.rows.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Parents retrieved successfully.",
        data: {
          parents: [],
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    }

    const parentIds = result.rows.map((parent) => parent.id);

    // 7. Fetch full parent records and ALL student relationships.
    // Do not apply the relationship filter here: childrenCount
    // must reflect every linked student.
    const fullParents = await Parent.findAll({
      where: {
        schoolId,
        id: { [Op.in]: parentIds },
      },

      attributes: [
        "id",
        "userId",
        "status",
        "createdAt",
      ],

      include: [
        {
          model: User,
          as: "user",
          attributes: [
            "firstName",
            "surName",
            "phoneNumber",
            "loginId",
            "email",
            "status",
          ],
          required: true,
        },

        {
          model: ParentStudent,
          as: "studentRelationships",
          attributes: [
            "id",
            "studentId",
            "relationship",
            "receivesNotifications",
          ],
          required: false,

          include: [
            {
              model: Student,
              as: "student",
              attributes: [
                "id",
                "admissionNumber",
                "currentClassId",
              ],
              required: false,

              include: [
                {
                  model: User,
                  as: "user",
                  attributes: ["firstName", "surName"],
                  required: false,
                },
              ],
            },
          ],
        },
      ],
    });

    // 8. Restore the pagination query's ordering.
    const parentMap = new Map(
      fullParents.map((parent) => [
        parent.id,
        parent.toJSON(),
      ])
    );

    const parents = parentIds
      .map((id) => parentMap.get(id))
      .filter(Boolean)
      .map((parent) => {
        const user = parent.user;
        const relationships = parent.studentRelationships ?? [];

        return {
          id: parent.id,
          userId: parent.userId,

          firstName: user.firstName,
          surName: user.surName,
          phoneNumber: user.phoneNumber,
          loginId: user.loginId,
          email: user.email,

          status: parent.status,
          userStatus: user.status,

          childrenCount: relationships.length,

          studentRelationships: relationships.map((item) => ({
            id: item.id,
            studentId: item.studentId,
            relationship: item.relationship,
            receivesNotifications: item.receivesNotifications,

            student: item.student
              ? {
                  id: item.student.id,
                  admissionNumber: item.student.admissionNumber,
                  firstName: item.student.user?.firstName ?? null,
                  surName: item.student.user?.surName ?? null,
                  currentClassId: item.student.currentClassId,
                }
              : null,
          })),

          createdAt: parent.createdAt,
        };
      });

    // 9. Return results and pagination metadata.
    return res.status(200).json({
      success: true,
      message: "Parents retrieved successfully.",

      data: {
        parents,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("GET_ALL_PARENTS_ERROR:", {
      schoolId: req.user?.schoolId,
      error,
    });

    return next(
      error instanceof AppError
        ? error
        : new AppError(
            isDev
              ? error.message
              : "Unable to retrieve parents. Please try again.",
            500
          )
    );
  }
};


export const linkParentToStudent = async (req, res, next) => {
  let transaction;

  try {
    // 1. Get the authenticated school.
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        success: false,
        message: "School authentication is required.",
      });
    }

    // 2. Read validated request data.
    const { parentId, studentId, relationship } = req.body;

    // 3. Start the transaction.
    transaction = await dbConnection.transaction();

    // 4. Find the existing parent in this school.
    const parent = await Parent.findOne({
      where: {
        id: parentId,
        schoolId,
      },
      transaction,
    });

    if (!parent) {
      await transaction.rollback();
      transaction = null;

      return res.status(404).json({
        success: false,
        code: "PARENT_NOT_FOUND",
        message: "Parent not found in your school.",
      });
    }

    // 5. Find the existing student in this school.
    const studentRecord = await Student.findOne({
      where: {
        id: studentId,
        schoolId,
      },
      transaction,
    });

    if (!studentRecord) {
      await transaction.rollback();
      transaction = null;

      return res.status(404).json({
        success: false,
        code: "STUDENT_NOT_FOUND",
        message: "Student not found in your school.",
      });
    }

    // 6. Prevent duplicate parent-student relationships.
    const existingLink = await ParentStudent.findOne({
      where: {
        schoolId,
        parentId: parent.id,
        studentId: studentRecord.id,
      },
      transaction,
    });

    if (existingLink) {
      await transaction.rollback();
      transaction = null;

      return res.status(409).json({
        success: false,
        code: "PARENT_STUDENT_LINK_EXISTS",
        message:
          "This parent is already linked to this student.",
      });
    }

    // 7. Create the relationship only.
    const parentStudentLink = await ParentStudent.create(
      {
        schoolId,
        parentId: parent.id,
        studentId: studentRecord.id,
        relationship,
        // receivesNotifications defaults to true in the model.
      },
      { transaction }
    );

    // 8. Commit the relationship.
    await transaction.commit();
    transaction = null;

    // 9. Return the created relationship.
    return res.status(201).json({
      success: true,
      message: "Parent linked to student successfully.",
      relationship: {
        id: parentStudentLink.id,
        parentId: parentStudentLink.parentId,
        studentId: parentStudentLink.studentId,
        relationship: parentStudentLink.relationship,
        receivesNotifications:
          parentStudentLink.receivesNotifications,
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error(
          "LINK_PARENT_ROLLBACK_ERROR:",
          rollbackError
        );
      }
    }

    console.error("LINK_PARENT_TO_STUDENT_ERROR:", {
      schoolId: req.user?.schoolId,
      parentId: req.body?.parentId,
      studentId: req.body?.studentId,
      error,
    });

    return next(
      error instanceof AppError
        ? error
        : new AppError(
            isDev
              ? error.message
              : "Unable to link the parent to the student. Please try again.",
            500
          )
    );
  }
};


export const unlinkParentFromStudent = async (req, res, next) => {
  let transaction;

  try {
    // 1. Get the authenticated school.
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        success: false,
        message: "School authentication is required.",
      });
    }

    // 2. Read validated request data.
    const { parentId, studentId } = req.body;

    // 3. Start the transaction.
    transaction = await dbConnection.transaction();

    // 4. Verify that the parent belongs to this school.
    const parent = await Parent.findOne({
      where: {
        id: parentId,
        schoolId,
      },
      transaction,
    });

    if (!parent) {
      await transaction.rollback();
      transaction = null;

      return res.status(404).json({
        success: false,
        code: "PARENT_NOT_FOUND",
        message: "Parent not found in your school.",
      });
    }

    // 5. Verify that the student belongs to this school.
    const student = await Student.findOne({
      where: {
        id: studentId,
        schoolId,
      },
      transaction,
    });

    if (!student) {
      await transaction.rollback();
      transaction = null;

      return res.status(404).json({
        success: false,
        code: "STUDENT_NOT_FOUND",
        message: "Student not found in your school.",
      });
    }

    // 6. Find the specific parent-student relationship.
    const parentStudentLink = await ParentStudent.findOne({
      where: {
        schoolId,
        parentId: parent.id,
        studentId: student.id,
      },
      transaction,
    });

    if (!parentStudentLink) {
      await transaction.rollback();
      transaction = null;

      return res.status(404).json({
        success: false,
        code: "PARENT_STUDENT_LINK_NOT_FOUND",
        message:
          "This parent is not linked to this student.",
      });
    }

    // 7. Delete only the relationship.
    await parentStudentLink.destroy({ transaction });

    // 8. Commit the deletion.
    await transaction.commit();
    transaction = null;

    // 9. Return the result.
    return res.status(200).json({
      success: true,
      message: "Parent unlinked from student successfully.",
      unlinkedRelationship: {
        parentId: parent.id,
        studentId: student.id,
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error(
          "UNLINK_PARENT_ROLLBACK_ERROR:",
          rollbackError
        );
      }
    }

    console.error("UNLINK_PARENT_FROM_STUDENT_ERROR:", {
      schoolId: req.user?.schoolId,
      parentId: req.body?.parentId,
      studentId: req.body?.studentId,
      error,
    });

    return next(
      error instanceof AppError
        ? error
        : new AppError(
            isDev
              ? error.message
              : "Unable to unlink the parent from the student. Please try again.",
            500
          )
    );
  }
};

export const deleteParent = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;
    const { parentId } = req.params;

    if (!schoolId) {
      return next(
        new AppError("Authenticated school not found.", 401)
      );
    }

    const result = await dbConnection.transaction(
      async (transaction) => {
        // 1. Find the parent within the authenticated school.
        const parent = await Parent.findOne({
          where: {
            id: parentId,
            schoolId,
          },
          transaction,
        });

        if (!parent) {
          throw new AppError(
            "Parent not found in this school.",
            404
          );
        }

        // 2. Find the associated user account.
        const user = await User.findOne({
          where: {
            id: parent.userId,
            schoolId,
          },
          transaction,
        });

        if (!user) {
          throw new AppError(
            "The parent's user account could not be found.",
            409
          );
        }

        // 3. Remove all relationships between this parent
        // and their students.
        const removedRelationships = await ParentStudent.destroy({
          where: {
            schoolId,
            parentId: parent.id,
          },
          transaction,
        });

        // 4. Delete the parent record.
        await parent.destroy({ transaction });

        // 5. Permanently delete the associated user account.
        await user.destroy({ transaction });

        return {
          parentId: parent.id,
          removedRelationships,
        };
      }
    );

    return res.status(200).json({
      success: true,
      message:
        "Parent, user account, and all student relationships deleted successfully.",
      data: result,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }

    return next(error);
  }
};



export const getParentDashboard = async (req, res, next) => {
  try {
    const { schoolId, id: userId, role } = req.user ?? {};

    if (!schoolId || !userId) {
      return next(new AppError("Authentication is required.", 401));
    }

    if (role !== "PARENT") {
      return next(
        new AppError(
          "Only parent accounts can access this dashboard.",
          403
        )
      );
    }

    // 1. Find the authenticated parent's active profile.
    const parent = await Parent.findOne({
      where: {
        schoolId,
        userId,
        status: "ACTIVE",
      },
      attributes: ["id", "userId"],
      include: [
        {
          model: User,
          as: "user",
          attributes: [
            "firstName",
            "surName",
            "profileImageUrl",
          ],
          required: true,
          where: {
            schoolId,
            role: "PARENT",
            status: "ACTIVE",
          },
        },
      ],
    });

    if (!parent) {
      return next(
        new AppError(
          "Your active parent profile could not be found.",
          404
        )
      );
    }

    // 2. Retrieve all children linked to this parent.
    // Include every admission status and allow a missing current class.
    const relationships = await ParentStudent.findAll({
      where: {
        schoolId,
        parentId: parent.id,
      },
      attributes: [
        "studentId",
        "relationship",
        "receivesNotifications",
      ],
      include: [
        {
          model: Student,
          as: "student",
          attributes: [
            "id",
            "admissionNumber",
            "qrToken",
            "currentClassId",
            "admissionStatus",
          ],
          required: true,
          where: { schoolId },
          include: [
            {
              model: User,
              as: "user",
              attributes: ["firstName", "surName", "email"],
              required: true,
              where: { schoolId },
            },
            {
              model: Class,
              as: "currentClass",
              attributes: ["id", "classLevel", "arm"],
              required: false,
              where: { schoolId },
            },
          ],
        },
      ],
      order: [
        ["createdAt", "ASC"],
        ["studentId", "ASC"],
      ],
    });

    // 3. Identify the school's current active session and term.
    const session = await Session.findOne({
      where: {
        schoolId,
        status: "ACTIVE",
        isCurrent: true,
      },
      attributes: ["id", "sessionName"],
    });

    let term = null;

    if (session) {
      term = await Term.findOne({
        where: {
          sessionId: session.id,
          status: "ACTIVE",
          isCurrent: true,
        },
        attributes: ["id", "termName"],
      });
    }

    // 4. Initialize attendance summaries for every linked child.
    const attendanceByStudent = new Map();

    for (const relationship of relationships) {
      const student = relationship.student;

      attendanceByStudent.set(student.id, {
        available: Boolean(session && term),
        presentDays: 0,
        absentDays: 0,
        totalRecordedDays: 0,
        percentage: null,
      });
    }

    const studentIds = relationships.map(
      (relationship) => relationship.student.id
    );

    // 5. Fetch attendance for ALL linked children in one query.
    // Only confirmed records in submitted registers count.
    if (session && term && studentIds.length > 0) {
      const attendanceRecords = await AttendanceRecord.findAll({
        attributes: ["studentId", "status"],
        where: {
          studentId: {
            [Op.in]: studentIds,
          },
          status: {
            [Op.in]: ["PRESENT", "ABSENT"],
          },
        },
        include: [
          {
            model: AttendanceRegister,
            as: "attendanceRegister",
            attributes: [],
            required: true,
            where: {
              schoolId,
              sessionId: session.id,
              termId: term.id,
              status: "SUBMITTED",
            },
          },
        ],
      });

      // 6. Aggregate the results in memory.
      for (const record of attendanceRecords) {
        const attendance = attendanceByStudent.get(
          record.studentId
        );

        // Ignore any record not belonging to our initialized students.
        if (!attendance) continue;

        if (record.status === "PRESENT") {
          attendance.presentDays += 1;
        } else if (record.status === "ABSENT") {
          attendance.absentDays += 1;
        }
      }

      // 7. Calculate each child's attendance percentage.
      for (const attendance of attendanceByStudent.values()) {
        attendance.totalRecordedDays =
          attendance.presentDays + attendance.absentDays;

        attendance.percentage =
          attendance.totalRecordedDays > 0
            ? Math.round(
                (attendance.presentDays /
                  attendance.totalRecordedDays) *
                  1000
              ) / 10
            : null;
      }
    }

    // 8. Build the dashboard response.
    const children = relationships.map((relationship) => {
      const student = relationship.student;

      return {
        id: student.id,
        firstName: student.user.firstName,
        surName: student.user.surName,
        admissionNumber: student.admissionNumber,
        email: student.user.email,
        qrToken: student.qrToken,
        admissionStatus: student.admissionStatus,

        class: student.currentClass
          ? {
              id: student.currentClass.id,
              classLevel: student.currentClass.classLevel,
              arm: student.currentClass.arm,
            }
          : null,

        relationship: relationship.relationship,
        receivesNotifications:
          relationship.receivesNotifications,

        attendance: attendanceByStudent.get(student.id),
      };
    });

    return res.status(200).json({
      success: true,
      message: "Parent dashboard retrieved successfully.",
      data: {
        parent: {
          firstName: parent.user.firstName,
          surName: parent.user.surName,
          profileImageUrl: parent.user.profileImageUrl,
        },

        summary: {
          childrenCount: children.length,
        },

        attendancePeriod:
          session && term
            ? {
                sessionName: session.sessionName,
                termName: term.termName,
              }
            : null,

        children,
      },
    });
  } catch (error) {
    console.error("GET_PARENT_DASHBOARD_ERROR:", {
      schoolId: req.user?.schoolId,
      userId: req.user?.id,
      error,
    });

    return next(
      error instanceof AppError
        ? error
        : new AppError(
            isDev
              ? error.message
              : "Unable to retrieve the parent dashboard. Please try again.",
            500
          )
    );
  }
};


export const requestChildEmailChange = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { newEmail, currentPassword } = req.body;

    const schoolId = req.user?.schoolId;
    const parentUserId = req.user?.id;

    if (!schoolId || !parentUserId) {
      throw new AppError("Authentication is required.", 401);
    }

    const normalizedEmail = newEmail.trim().toLowerCase();

    const { parentUser, childUser } = await getParentAndLinkedChild({
      parentUserId,
      schoolId,
      studentId,
    });

    // Reauthenticate the parent, not the child.
    const passwordMatches = await bcrypt.compare(
      currentPassword,
      parentUser.passwordHash
    );

    if (!passwordMatches) {
      throw new AppError("Your current password is incorrect.", 401);
    }

    if (childUser.email?.trim().toLowerCase() === normalizedEmail) {
      throw new AppError(
        "This is already the student's email address.",
        400
      );
    }

    // Email addresses must be unique across the entire platform.
    const existingUser = await User.findOne({
      where: {
        email: normalizedEmail,
        id: { [Op.ne]: childUser.id },
      },
    });

    if (existingUser) {
      throw new AppError(
        "This email address is already in use.",
        409
      );
    }

    const code = String(generateVerificationCode()).padStart(6, "0");
    const expiryTime = generateExpiryTime();

    // Replace only the child's previous email-change code.
    // Do not delete password-reset or other verification codes.
    await VerificationCode.destroy({
      where: {
        userId: childUser.id,
        purpose: CHILD_EMAIL_CHANGE_PURPOSE,
      },
    });

    await VerificationCode.create({
      code,
      expiryTime,
      userEmail: normalizedEmail,
      userId: childUser.id,
      purpose: CHILD_EMAIL_CHANGE_PURPOSE,
    });

    try {
      await sendEmail({
        to: normalizedEmail,
        subject: "Verify your child's new ScholaNode email address",
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#333;">
            <h2 style="color:#071A52;">ScholaNode Email Verification</h2>
            <p>Hello ${escapeHtml(parentUser.firstName)},</p>
            <p>
              A request was made to change the email address of your
              linked child's ScholaNode account.
            </p>
            <p>Your verification code is:</p>
            <h1 style="letter-spacing:6px;color:#071A52;">${code}</h1>
            <p>
              This code expires soon. If you did not request this change,
              you can ignore this email.
            </p>
          </div>
        `,
      });
    } catch (emailError) {
      // Remove only the code created by this request.
      await VerificationCode.destroy({
        where: {
          userId: childUser.id,
          userEmail: normalizedEmail,
          code,
          purpose: CHILD_EMAIL_CHANGE_PURPOSE,
        },
      });

      throw emailError;
    }

    return res.status(200).json({
      success: true,
      message: "A verification code has been sent to the new email address.",
    });
  } catch (error) {
    return next(error);
  }
};

export const verifyChildEmailChange = async (req, res, next) => {
  let transaction;

  try {
    const { studentId } = req.params;
    const { newEmail, code } = req.body;

    const schoolId = req.user?.schoolId;
    const parentUserId = req.user?.id;

    if (!schoolId || !parentUserId) {
      throw new AppError("Authentication is required.", 401);
    }

    const normalizedEmail = newEmail.trim().toLowerCase();

    transaction = await dbConnection.transaction();

    // Recheck the parent-child relationship during verification.
    const { childUser } = await getParentAndLinkedChild({
      parentUserId,
      schoolId,
      studentId,
      transaction,
    });

    const verification = await VerificationCode.findOne({
      where: {
        userId: childUser.id,
        userEmail: normalizedEmail,
        code,
        purpose: CHILD_EMAIL_CHANGE_PURPOSE,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!verification) {
      throw new AppError(
        "Invalid verification code or email address.",
        400
      );
    }

    if (Number(verification.expiryTime) <= Date.now()) {
      throw new AppError(
        "This verification code has expired. Please request a new code.",
        400
      );
    }

    if (childUser.email?.trim().toLowerCase() === normalizedEmail) {
      throw new AppError(
        "This is already the student's email address.",
        400
      );
    }

    // Check availability again because another account may have
    // registered this email since the code was requested.
    const existingUser = await User.findOne({
      where: {
        email: normalizedEmail,
        id: { [Op.ne]: childUser.id },
      },
      transaction,
    });

    if (existingUser) {
      throw new AppError(
        "This email address is already in use.",
        409
      );
    }

    // Update the child's User record only after successful verification.
    await childUser.update(
      { email: normalizedEmail },
      { transaction }
    );

    // Consume all email-change codes for this child only.
    await VerificationCode.destroy({
      where: {
        userId: childUser.id,
        purpose: CHILD_EMAIL_CHANGE_PURPOSE,
      },
      transaction,
    });

    await transaction.commit();
    transaction = null;

    return res.status(200).json({
      success: true,
      message: "Your child's email address has been updated successfully.",
      data: {
        studentId,
        email: normalizedEmail,
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    return next(error);
  }
};