import bcrypt from "bcryptjs";

import { dbConnection } from "../config/db.js";

import { Op, fn, col, where as sequelizeWhere } from "sequelize";
import {
  Student,
  User,
  Class,
  ParentStudent,
} from "../relationships/associations.js";

export const createStudent = async (req, res, next) => {
  let transaction;

  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        success: false,
        message: "School authentication is required.",
      });
    }

    const {
      firstName,
      surName,
      admissionNumber,
      gender,
      dateOfBirth,
      currentClassId,
      enrollmentDate,
    } = req.body;

    const normalizedAdmissionNumber = admissionNumber
      .trim()
      .toUpperCase();

    transaction = await dbConnection.transaction();

    const existingStudent = await Student.findOne({
      where: {
        schoolId,
        admissionNumber: normalizedAdmissionNumber,
      },
      transaction,
    });

    if (existingStudent) {
      await transaction.rollback();
      transaction = null;

      return res.status(409).json({
        success: false,
        message: "This admission number already exists in your school.",
      });
    }

    const existingUser = await User.findOne({
      where: {
        schoolId,
        loginId: normalizedAdmissionNumber,
      },
      transaction,
    });

    if (existingUser) {
      await transaction.rollback();
      transaction = null;

      return res.status(409).json({
        success: false,
        message: "This login ID is already in use in your school.",
      });
    }

    // Admission number is both the login ID and initial password.
    const passwordHash = await bcrypt.hash(
      normalizedAdmissionNumber,
      12
    );

    const user = await User.create(
      {
        schoolId,
        firstName: firstName.trim(),
        surName: surName.trim(),
        loginId: normalizedAdmissionNumber,
        passwordHash,
        mustChangePassword: true,
        profileCompleted: false,
        role: "STUDENT",
        status: "ACTIVE",
        email: null,
        phoneNumber: null,
      },
      { transaction }
    );

    const student = await Student.create(
      {
        schoolId,
        userId: user.id,
        admissionNumber: normalizedAdmissionNumber,
        gender,
        dateOfBirth: dateOfBirth || null,
        currentClassId: currentClassId || null,
        enrollmentDate: enrollmentDate || null,
        admissionStatus: "ACTIVE",
      },
      { transaction }
    );

    await transaction.commit();
    transaction = null;

    return res.status(201).json({
      success: true,
      message: "Student created successfully.",
      data: {
        student: {
          id: student.id,
          userId: user.id,
          schoolId: student.schoolId,
          firstName: user.firstName,
          surName: user.surName,
          loginId: user.loginId,
          admissionNumber: student.admissionNumber,
          gender: student.gender,
          dateOfBirth: student.dateOfBirth,
          currentClassId: student.currentClassId,
          enrollmentDate: student.enrollmentDate,
          admissionStatus: student.admissionStatus,
          status: user.status,
          mustChangePassword: user.mustChangePassword,
          createdAt: student.createdAt,
        },
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message:
          "This admission number or login ID is already in use in your school.",
      });
    }

    next(error);
  }
};



export const getAllStudents = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(403).json({
        success: false,
        message: "School access is required.",
      });
    }

    const {
      page = 1,
      limit = 20,
      search = "",
      currentClassId,
      gender,
      admissionStatus,
    } = req.validatedQuery ?? req.query;

    const currentPage = Number(page);
    const pageSize = Number(limit);
    const offset = (currentPage - 1) * pageSize;

    const where = { schoolId };

    if (currentClassId) {
      where.currentClassId = currentClassId;
    }

    if (gender) {
      where.gender = gender;
    }

    if (admissionStatus) {
      where.admissionStatus = admissionStatus;
    }

    // Search first name, surname, full name, or admission number.
    if (search.trim()) {
      const searchTerm = `%${search.trim()}%`;

      where[Op.or] = [
        {
          admissionNumber: {
            [Op.iLike]: searchTerm,
          },
        },
        {
          "$user.firstName$": {
            [Op.iLike]: searchTerm,
          },
        },
        {
          "$user.surName$": {
            [Op.iLike]: searchTerm,
          },
        },
        sequelizeWhere(
          fn(
            "concat",
            col("user.firstName"),
            " ",
            col("user.surName")
          ),
          {
            [Op.iLike]: searchTerm,
          }
        ),
        sequelizeWhere(
          fn(
            "concat",
            col("user.surName"),
            " ",
            col("user.firstName")
          ),
          {
            [Op.iLike]: searchTerm,
          }
        ),
      ];
    }

    const { count, rows } = await Student.findAndCountAll({
      where,
      attributes: [
        "id",
        "userId",
        "admissionNumber",
        "gender",
        "dateOfBirth",
        "currentClassId",
        "enrollmentDate",
        "admissionStatus",
        "createdAt",
      ],
      include: [
        {
          model: User,
          as: "user",
          attributes: [
            "firstName",
            "surName",
            "status",
            "profileImageUrl",
            "lastLoginAt",
          ],
          required: true,
        },
        {
          model: Class,
          as: "currentClass",
          attributes: ["id", "classLevel", "arm"],
          required: false,
        },
      ],
      order: [
        ["createdAt", "DESC"],
        ["id", "ASC"],
      ],
      limit: pageSize,
      offset,
      distinct: true,
      col: "id",
    });

    // Get actual parent counts for students on this page.
    const studentIds = rows.map((student) => student.id);
    const parentCounts = new Map();

    if (studentIds.length > 0) {
      const relationshipCounts = await ParentStudent.findAll({
        attributes: [
          "studentId",
          [
            fn("COUNT", fn("DISTINCT", col("parentId"))),
            "parentCount",
          ],
        ],
        where: {
          schoolId,
          studentId: { [Op.in]: studentIds },
        },
        group: ["studentId"],
        raw: true,
      });

      relationshipCounts.forEach((item) => {
        parentCounts.set(
          item.studentId,
          Number(item.parentCount)
        );
      });
    }

    // Global school summary: not limited to the current page.
    const [totalStudents, activeStudents] = await Promise.all([
      Student.count({
        where: { schoolId },
      }),

      Student.count({
        where: {
          schoolId,
          admissionStatus: "ACTIVE",
        },
        include: [
          {
            model: User,
            as: "user",
            attributes: [],
            where: { status: "ACTIVE" },
            required: true,
          },
        ],
        distinct: true,
        col: "id",
      }),
    ]);

    const students = rows.map((student) => {
      const item = student.toJSON();

      return {
        id: item.id,
        userId: item.userId,
        firstName: item.user.firstName,
        surName: item.user.surName,
        admissionNumber: item.admissionNumber,
        gender: item.gender,
        dateOfBirth: item.dateOfBirth,
        currentClassId: item.currentClassId,
        currentClass: item.currentClass?.classLevel ?? null,
        currentArm: item.currentClass?.arm ?? null,
        enrollmentDate: item.enrollmentDate,
        admissionStatus: item.admissionStatus,
        status: item.user.status,
        profileImageUrl: item.user.profileImageUrl,
        lastLoginAt: item.user.lastLoginAt,
        parentCount: parentCounts.get(item.id) ?? 0,
        createdAt: item.createdAt,
      };
    });

    const totalPages = Math.ceil(count / pageSize);

    return res.status(200).json({
      success: true,
      message: "Students retrieved successfully.",
      data: {
        students,
        pagination: {
          currentPage,
          pageSize,
          totalItems: count,
          totalPages,
          hasNextPage: currentPage < totalPages,
          hasPreviousPage: currentPage > 1,
        },
        summary: {
          totalStudents,
          activeStudents,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};


export const importStudents = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        success: false,
        message: "School authentication is required.",
      });
    }

    // The request has already passed importStudentsSchema.
    const students = req.body.students;

    // Normalize text for comparisons without changing display values.
    const normalizeText = (value) =>
      String(value ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();

    // 1. Reject duplicate admission numbers within this batch.
    const seenAdmissionNumbers = new Set();
    const duplicateAdmissionNumbers = new Set();

    for (const student of students) {
      const admissionNumber = student.admissionNumber
        .trim()
        .toUpperCase();

      student.admissionNumber = admissionNumber;

      if (seenAdmissionNumbers.has(admissionNumber)) {
        duplicateAdmissionNumbers.add(admissionNumber);
      }

      seenAdmissionNumbers.add(admissionNumber);
    }

    if (duplicateAdmissionNumbers.size > 0) {
      return res.status(400).json({
        success: false,
        message:
          `Duplicate admission numbers were found: ${
            [...duplicateAdmissionNumbers].join(", ")
          }. No students were created.`,
      });
    }

    const admissionNumbers = students.map(
      (student) => student.admissionNumber
    );

    // 2. Check existing student admission numbers and user login IDs.
    const [existingStudents, existingUsers] = await Promise.all([
      Student.findAll({
        where: {
          schoolId,
          admissionNumber: {
            [Op.in]: admissionNumbers,
          },
        },
        attributes: ["admissionNumber"],
      }),

      User.findAll({
        where: {
          schoolId,
          loginId: {
            [Op.in]: admissionNumbers,
          },
        },
        attributes: ["loginId"],
      }),
    ]);

    const existingAdmissionNumbers = new Set([
      ...existingStudents.map((student) =>
        student.admissionNumber?.trim().toUpperCase()
      ),
      ...existingUsers.map((user) =>
        user.loginId?.trim().toUpperCase()
      ),
    ]);

    const conflictingAdmissionNumbers = admissionNumbers.filter(
      (admissionNumber) =>
        existingAdmissionNumbers.has(admissionNumber)
    );

    if (conflictingAdmissionNumbers.length > 0) {
      return res.status(409).json({
        success: false,
        message:
          `These admission numbers already exist or are in use: ${
            [...new Set(conflictingAdmissionNumbers)].join(", ")
          }. No students were created.`,
      });
    }

    // 3. Load classes belonging to this authenticated school.
    // The spreadsheet never supplies database class IDs.
    const schoolClasses = await Class.findAll({
      where: { schoolId },
      attributes: ["id", "classLevel", "arm"],
    });

    const resolvedClasses = [];
    const classErrors = [];

    // Resolve each student's class before creating any records.
    students.forEach((student, index) => {
      const rowNumber = index + 2; // Header row is row 1.

      const classLevel = student.classLevel?.trim() || null;
      const arm = student.arm?.trim() || null;

      // No class assignment was supplied.
      if (!classLevel && !arm) {
        resolvedClasses.push(null);
        return;
      }

      // An arm cannot be resolved without its class level.
      if (!classLevel && arm) {
        classErrors.push({
          row: rowNumber,
          admissionNumber: student.admissionNumber,
          message: "Class level is required when an arm is supplied.",
        });

        resolvedClasses.push(null);
        return;
      }

      const matchingLevels = schoolClasses.filter(
        (schoolClass) =>
          normalizeText(schoolClass.classLevel) ===
          normalizeText(classLevel)
      );

      if (matchingLevels.length === 0) {
        classErrors.push({
          row: rowNumber,
          admissionNumber: student.admissionNumber,
          message:
            `Class level "${classLevel}" does not exist in this school.`,
        });

        resolvedClasses.push(null);
        return;
      }

      // When an arm is supplied, match both class level and arm.
      if (arm) {
        const matchingClasses = matchingLevels.filter(
          (schoolClass) =>
            normalizeText(schoolClass.arm) === normalizeText(arm)
        );

        if (matchingClasses.length !== 1) {
          classErrors.push({
            row: rowNumber,
            admissionNumber: student.admissionNumber,
            message:
              matchingClasses.length === 0
                ? `Arm "${arm}" does not exist under class level "${classLevel}".`
                : `Class level "${classLevel}" and arm "${arm}" match multiple classes.`,
          });

          resolvedClasses.push(null);
          return;
        }

        resolvedClasses.push(matchingClasses[0]);
        return;
      }

      // Without an arm, only accept a uniquely matching class.
      if (matchingLevels.length > 1) {
        const availableArms = [
          ...new Set(
            matchingLevels.map(
              (schoolClass) => schoolClass.arm || "(no arm)"
            )
          ),
        ];

        classErrors.push({
          row: rowNumber,
          admissionNumber: student.admissionNumber,
          message:
            `Class level "${classLevel}" is ambiguous. Specify an arm. ` +
            `Available options: ${availableArms.join(", ")}.`,
        });

        resolvedClasses.push(null);
        return;
      }

      resolvedClasses.push(matchingLevels[0]);
    });

    if (classErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Some student class assignments are invalid. No students were created.",
        data: {
          errors: classErrors,
        },
      });
    }

    // 4. Create all User and Student records in one transaction.
    // Any failure rolls back the complete batch.
    const importedStudents = await dbConnection.transaction(
      async (transaction) => {
        const createdStudents = [];

        for (let index = 0; index < students.length; index++) {
          const studentData = students[index];
          const resolvedClass = resolvedClasses[index];

          const admissionNumber = studentData.admissionNumber;

          // Match the individual student creation flow.
          const passwordHash = await bcrypt.hash(
            admissionNumber,
            12
          );

          const user = await User.create(
            {
              schoolId,
              firstName: studentData.firstName,
              surName: studentData.surName,
              loginId: admissionNumber,
              passwordHash,
              mustChangePassword: true,
              profileCompleted: false,
              role: "STUDENT",
              status: "ACTIVE",
              email: null,
              phoneNumber: null,
            },
            { transaction }
          );

          const student = await Student.create(
            {
              schoolId,
              userId: user.id,
              admissionNumber,
              gender: studentData.gender,
              dateOfBirth: studentData.dateOfBirth || null,
              currentClassId: resolvedClass?.id ?? null,
              enrollmentDate: studentData.enrollmentDate || null,
              admissionStatus: "ACTIVE",
            },
            { transaction }
          );

          createdStudents.push({
            id: student.id,
            userId: user.id,
            firstName: user.firstName,
            surName: user.surName,
            loginId: user.loginId,
            admissionNumber: student.admissionNumber,
            gender: student.gender,
            dateOfBirth: student.dateOfBirth,
            currentClassId: student.currentClassId,
            classLevel: resolvedClass?.classLevel ?? null,
            arm: resolvedClass?.arm ?? null,
            enrollmentDate: student.enrollmentDate,
            admissionStatus: student.admissionStatus,
            status: user.status,
            mustChangePassword: user.mustChangePassword,
            createdAt: student.createdAt,
          });
        }

        return createdStudents;
      }
    );

    // 5. Return safe student details. Never return password hashes.
    return res.status(201).json({
      success: true,
      message: "Students imported successfully.",
      data: {
        totalImported: importedStudents.length,
        initialPasswordRule:
          "Each student's admission number is their initial password. Students must change it after signing in.",
        students: importedStudents,
      },
    });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message:
          "One or more admission numbers or login IDs are already in use. No students were imported.",
      });
    }

    return next(error);
  }
};