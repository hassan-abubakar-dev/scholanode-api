
import { Op } from "sequelize";

import User from "../models/User.js";
import Student from "../models/Student.js";
import Parent from "../models/Parent.js";
import ParentStudent from "../models/ParentStudent.js";
import GateScanner from "../models/GateScanner.js";
import GateScanRecord from "../models/GateScanRecord.js";

import AppError from "../utils/AppError.js";


// Staff roles that may scan when explicitly authorized.
const STAFF_SCANNER_ROLES = [
  "LEADER",
  "VICE_LEADER",
  "ADMINISTRATOR",
  "EXAM_OFFICER",
  "STAFF",
];

// Return only the student information needed for gate verification.
const formatStudent = (student) => ({
  studentId: student.id,
  firstName: student.user.firstName,
  surName: student.user.surName,
  admissionNumber: student.admissionNumber,
  gender: student.gender,
  profileImageUrl: student.user.profileImageUrl,
  admissionStatus: student.admissionStatus,
  class: student.class
    ? {
        id: student.class.id,
        classLevel: student.class.classLevel,
        arm: student.class.arm,
      }
    : null,
});

// Verify a student using either QR token or admission number.
// This function does not create a gate scan record.
export const verifyStudent = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;
    const userId = req.user?.id;
    const { method, value } = req.body;

    if (!schoolId || !userId) {
      return next(
        new AppError(
          "Authenticated user or school not found.",
          401
        )
      );
    }

    // Always check the current account status and role in the database.
    const scanner = await User.findOne({
      where: {
        id: userId,
        schoolId,
      },
      attributes: ["id", "schoolId", "role", "status"],
    });

    if (!scanner) {
      return next(
        new AppError("Scanner account not found.", 401)
      );
    }

    if (scanner.status !== "ACTIVE") {
      return next(
        new AppError(
          "Your account is not active and cannot scan students.",
          403
        )
      );
    }

    // SECURITY users can scan directly.
    // Other staff must have an active GateScanner permission.
    if (scanner.role !== "SECURITY") {
      if (!STAFF_SCANNER_ROLES.includes(scanner.role)) {
        return next(
          new AppError(
            "Your role is not permitted to scan students.",
            403
          )
        );
      }

      const scannerPermission = await GateScanner.findOne({
        where: {
          schoolId,
          userId: scanner.id,
          isActive: true,
        },
        attributes: ["id"],
      });

      if (!scannerPermission) {
        return next(
          new AppError(
            "You have not been authorized to scan students.",
            403
          )
        );
      }
    }

    // Build the lookup using the selected identification method.
    const studentWhere = {
      schoolId,
      ...(method === "QR"
        ? { qrToken: value }
        : { admissionNumber: value }),
    };

    const student = await Student.findOne({
      where: studentWhere,
      attributes: [
        "id",
        "schoolId",
        "admissionNumber",
        "gender",
        "currentClassId",
        "admissionStatus",
      ],
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
          where: { schoolId },
        },
        {
          // Assumes Student.belongsTo(Class, { as: "class" }).
          association: "class",
          attributes: ["id", "classLevel", "arm"],
          required: false,
        },
        {
          model: ParentStudent,
          as: "parentRelationships",
          attributes: ["parentId"],
          required: false,
          where: { schoolId },
          include: [
            {
              model: Parent,
              as: "parent",
              attributes: ["id"],
              required: true,
              where: {
                schoolId,
                status: "ACTIVE",
              },
            },
          ],
        },
      ],
    });

    if (!student) {
      return next(
        new AppError(
          method === "QR"
            ? "No student was found for this QR code."
            : "No student was found with this admission number.",
          404
        )
      );
    }

    if (student.admissionStatus !== "ACTIVE") {
      return next(
        new AppError(
          `This student is ${student.admissionStatus.toLowerCase()} and cannot be verified for gate entry.`,
          403
        )
      );
    }

    // Extract the student's active parent relationships.
    const parentIds = [
      ...new Set(
        (student.parentRelationships || [])
          .map((relationship) => relationship.parentId)
          .filter(Boolean)
      ),
    ];

    let familyMembers = [];

    if (parentIds.length > 0) {
      const relatedStudents = await ParentStudent.findAll({
        where: {
          schoolId,
          parentId: { [Op.in]: parentIds },
          studentId: { [Op.ne]: student.id },
        },
        attributes: ["studentId"],
        include: [
          {
            model: Parent,
            as: "parent",
            attributes: ["id"],
            required: true,
            where: {
              schoolId,
              status: "ACTIVE",
            },
          },
          {
            model: Student,
            as: "student",
            attributes: [
              "id",
              "schoolId",
              "admissionNumber",
              "gender",
              "currentClassId",
              "admissionStatus",
            ],
            required: true,
            where: {
              schoolId,
              admissionStatus: "ACTIVE",
            },
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
                where: { schoolId },
              },
              {
                // Uses the same class association as above.
                association: "class",
                attributes: ["id", "classLevel", "arm"],
                required: false,
              },
            ],
          },
        ],
      });

      // A student can share more than one parent with the same sibling.
      // Return each related student only once.
      const uniqueFamily = new Map();

      for (const relationship of relatedStudents) {
        const familyStudent = relationship.student;

        if (familyStudent) {
          uniqueFamily.set(
            familyStudent.id,
            formatStudent(familyStudent)
          );
        }
      }

      familyMembers = [...uniqueFamily.values()];
    }

    return res.status(200).json({
      success: true,
      message: "Student verified successfully.",
      student: formatStudent(student),
      familyMembers,
    });
  } catch (error) {
    return next(error);
  }
};




// Record confirmed student arrivals or returns.
export const recordStudentScan = async (req, res, next) => {
  let transaction;

  try {
    const schoolId = req.user?.schoolId;
    const userId = req.user?.id;
    const { studentIds, scanType } = req.body;

    if (!schoolId || !userId) {
      return next(
        new AppError(
          "Authenticated user or school not found.",
          401
        )
      );
    }

    transaction = await dbConnection.transaction();

    // Recheck the scanner's current account status and role.
    const scanner = await User.findOne({
      where: {
        id: userId,
        schoolId,
      },
      attributes: ["id", "role", "status"],
      transaction,
    });

    if (!scanner) {
      throw new AppError("Scanner account not found.", 401);
    }

    if (scanner.status !== "ACTIVE") {
      throw new AppError(
        "Your account is not active and cannot record scans.",
        403
      );
    }

    // SECURITY accounts can scan directly.
    // Other permitted staff need an active GateScanner record.
    if (scanner.role !== "SECURITY") {
      if (!STAFF_SCANNER_ROLES.includes(scanner.role)) {
        throw new AppError(
          "Your role is not permitted to record gate scans.",
          403
        );
      }

      const permission = await GateScanner.findOne({
        where: {
          schoolId,
          userId: scanner.id,
          isActive: true,
        },
        attributes: ["id"],
        transaction,
      });

      if (!permission) {
        throw new AppError(
          "You are not authorized to record gate scans.",
          403
        );
      }
    }

    // Find every selected student within this school.
    const students = await Student.findAll({
      where: {
        id: { [Op.in]: studentIds },
        schoolId,
        admissionStatus: "ACTIVE",
      },
      attributes: ["id"],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    // Fail the entire request if any selected student is
    // missing, belongs to another school, or is not active.
    if (students.length !== studentIds.length) {
      throw new AppError(
        "One or more selected students could not be verified as active students in this school. No scans were recorded.",
        400
      );
    }

    // The security officer's confirmation is represented by
    // this authenticated request. Save all records atomically.
    const scanRecords = await GateScanRecord.bulkCreate(
      students.map((student) => ({
        schoolId,
        studentId: student.id,
        scannedByUserId: scanner.id,
        scanType,
      })),
      {
        transaction,
        returning: true,
        validate: true,
      }
    );

    await transaction.commit();
    transaction = null;

    return res.status(201).json({
      success: true,
      message:
        scanType === "ARRIVAL"
          ? "Student arrival(s) recorded successfully."
          : "Student return(s) recorded successfully.",
      scanType,
      totalRecorded: scanRecords.length,
      records: scanRecords.map((record) => ({
        id: record.id,
        studentId: record.studentId,
        scanType: record.scanType,
        scannedAt: record.scannedAt,
        scannedByUserId: record.scannedByUserId,
      })),
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error(
          "RECORD_STUDENT_SCAN_ROLLBACK_ERROR:",
          rollbackError
        );
      }
    }

    return next(error);
  }
};
