
import { Op } from "sequelize";

import User from "../models/User.js";
import Student from "../models/Student.js";
import Parent from "../models/Parent.js";
import ParentStudent from "../models/ParentStudent.js";
import GateScanner from "../models/GateScanner.js";
import GateScanRecord from "../models/GateScanRecord.js";
import Class from "../models/Class.js"

import AppError from "../utils/AppError.js";

import { dbConnection } from "../config/db.js";


// Staff roles that may scan when explicitly authorized.
const STAFF_SCANNER_ROLES = [
  "LEADER",
  "VICE_LEADER",
  "ADMINISTRATOR",
  "EXAM_OFFICER",
  "STAFF",
];

// Only these roles can manage scanner permissions.
const SCANNER_MANAGER_ROLES = [
  "LEADER",
  "VICE_LEADER",
  "ADMINISTRATOR",
];

// Keep this consistent with STAFF_SCANNER_ROLES above.
const ELIGIBLE_SCANNER_ROLES = STAFF_SCANNER_ROLES;

// Always verify the manager's current account and role.
const getActiveScannerManager = async (schoolId, userId) => {
  if (!schoolId || !userId) {
    throw new AppError(
      "Authenticated user or school not found.",
      401
    );
  }

  const manager = await User.findOne({
    where: { id: userId, schoolId },
    attributes: ["id", "schoolId", "role", "status"],
  });

  if (!manager || manager.status !== "ACTIVE") {
    throw new AppError(
      "Your account is not active or could not be found.",
      403
    );
  }

  if (!SCANNER_MANAGER_ROLES.includes(manager.role)) {
    throw new AppError(
      "You are not authorized to manage scanner permissions.",
      403
    );
  }

  return manager;
};

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

// time zone generator
const SCHOOL_TIME_ZONE = "Africa/Lagos";

const getZonedDateParts = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );
};

const getTimeZoneOffset = (date, timeZone) => {
  const parts = getZonedDateParts(date, timeZone);

  const representedAsUTC = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  return representedAsUTC - Math.floor(date.getTime() / 1000) * 1000;
};

const localMidnightToUTC = (year, month, day, timeZone) => {
  const approximateUTC = Date.UTC(year, month - 1, day);

  let result =
    approximateUTC -
    getTimeZoneOffset(new Date(approximateUTC), timeZone);

  // Recalculate using the offset at the resulting instant.
  result =
    approximateUTC -
    getTimeZoneOffset(new Date(result), timeZone);

  return new Date(result);
};

const getSchoolDayRange = (
  now = new Date(),
  timeZone = SCHOOL_TIME_ZONE
) => {
  const { year, month, day } = getZonedDateParts(now, timeZone);

  const start = localMidnightToUTC(
    year,
    month,
    day,
    timeZone
  );

  // Advance the calendar date, not the timestamp by 24 hours.
  const nextDate = new Date(Date.UTC(year, month - 1, day + 1));

  const end = localMidnightToUTC(
    nextDate.getUTCFullYear(),
    nextDate.getUTCMonth() + 1,
    nextDate.getUTCDate(),
    timeZone
  );

  return { start, end };
};

// Verify a student using either QR token or admission number.
// This function does not create a gate scan record.
export const verifyStudent = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;
    const userId = req.user?.id;
    const { method, value, scanType } = req.body;

    if (!schoolId || !userId) {
      return next(
        new AppError(
          "Authenticated user or school not found.",
          401
        )
      );
    }

    // Recheck the scanner's current account status and role.
    const scanner = await User.findOne({
      where: { id: userId, schoolId },
      attributes: ["id", "schoolId", "role", "status"],
    });

    if (!scanner) {
      return next(new AppError("Scanner account not found.", 401));
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
    // Other permitted staff need an active GateScanner record.
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

    // Find the student using the requested identification method.
    const student = await Student.findOne({
      where: {
        schoolId,
        ...(method === "QR"
          ? { qrToken: value }
          : { admissionNumber: value }),
      },
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
          association: "currentClass",
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

    // Find students who share an active parent with this student.
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
                association: "currentClass",
                attributes: ["id", "classLevel", "arm"],
                required: false,
              },
            ],
          },
        ],
      });

      // Avoid returning the same family member more than once.
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

    // Retrieve today's records for the requested scan type.
    const allStudentIds = [
      student.id,
      ...familyMembers.map((member) => member.studentId),
    ];

    const { start, end } = getSchoolDayRange();

    const existingScans = await GateScanRecord.findAll({
      where: {
        schoolId,
        studentId: { [Op.in]: allStudentIds },
        scanType,
        scannedAt: {
          [Op.gte]: start,
          [Op.lt]: end,
        },
      },
      attributes: ["studentId", "scannedAt"],
      order: [["scannedAt", "ASC"]],
    });

    // Use the first scan if historical duplicates already exist.
    const scanMap = new Map();

    for (const record of existingScans) {
      if (!scanMap.has(record.studentId)) {
        scanMap.set(record.studentId, record.scannedAt);
      }
    }

    const createScanStatus = (studentId) => {
      const scannedAt = scanMap.get(studentId) ?? null;

      return {
        scanType,
        alreadyRecorded: Boolean(scannedAt),
        scannedAt,
      };
    };

    return res.status(200).json({
      success: true,
      message: "Student verified successfully.",
      student: {
        ...formatStudent(student),
        scanStatus: createScanStatus(student.id),
      },
      familyMembers: familyMembers.map((member) => ({
        ...member,
        scanStatus: createScanStatus(member.studentId),
      })),
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
      where: { id: userId, schoolId },
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

    // SECURITY users can scan directly.
    // Other permitted staff need active permission.
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

    // Lock selected student rows so concurrent scan requests
    // for the same students are serialized.
    const students = await Student.findAll({
      where: {
        id: { [Op.in]: studentIds },
        schoolId,
        admissionStatus: "ACTIVE",
      },
      attributes: ["id"],
      order: [["id", "ASC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    // Fail the entire request if any student is missing,
    // belongs to another school, or is not active.
    if (students.length !== studentIds.length) {
      throw new AppError(
        "One or more selected students could not be verified as active students in this school. No scans were recorded.",
        400
      );
    }

    // Check existing scans within the current school-local day.
    const { start, end } = getSchoolDayRange();

    const existingScans = await GateScanRecord.findAll({
      where: {
        schoolId,
        studentId: { [Op.in]: studentIds },
        scanType,
        scannedAt: {
          [Op.gte]: start,
          [Op.lt]: end,
        },
      },
      attributes: ["studentId"],
      transaction,
    });

    if (existingScans.length > 0) {
      const duplicateStudentIds = [
        ...new Set(existingScans.map((record) => record.studentId)),
      ];

      throw new AppError(
        `Cannot record ${scanType.toLowerCase()}. One or more selected students already have this scan recorded today. No scans were recorded. Please verify the students again.`,
        409
      );
    }

    // All students passed validation and duplicate checks.
    // Create every scan atomically.
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


// Grant an eligible staff member permission to scan students.
export const authorizeStaffScanner = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;
    const managerId = req.user?.id;
    const { userId } = req.body;

    await getActiveScannerManager(schoolId, managerId);

    // The selected staff member must belong to this school
    // and have an eligible role and active account.
    const staff = await User.findOne({
      where: {
        id: userId,
        schoolId,
        role: { [Op.in]: ELIGIBLE_SCANNER_ROLES },
        status: "ACTIVE",
      },
      attributes: ["id", "firstName", "surName", "role"],
    });

    if (!staff) {
      return next(
        new AppError(
          "The selected user is not an active, eligible staff member in this school.",
          404
        )
      );
    }

    // Reuse an existing permission record if access was revoked.
    const [permission, created] = await GateScanner.findOrCreate({
      where: { schoolId, userId: staff.id },
      defaults: {
        schoolId,
        userId: staff.id,
        isActive: true,
      },
    });

    if (!created && permission.isActive) {
      return next(
        new AppError(
          "This staff member is already authorized to scan.",
          409
        )
      );
    }

    if (!created) {
      await permission.update({ isActive: true });
    }

    return res.status(created ? 201 : 200).json({
      success: true,
      message: "Staff member authorized to scan successfully.",
      scanner: {
        id: permission.id,
        userId: staff.id,
        firstName: staff.firstName,
        surName: staff.surName,
        role: staff.role,
        isActive: permission.isActive,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// Revoke access without deleting the permission record.
export const revokeStaffScanner = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;
    const managerId = req.user?.id;
    const { userId } = req.params;

    await getActiveScannerManager(schoolId, managerId);

    const permission = await GateScanner.findOne({
      where: { schoolId, userId },
    });

    if (!permission) {
      return next(
        new AppError(
          "No scanner permission record was found for this staff member.",
          404
        )
      );
    }

    if (!permission.isActive) {
      return res.status(200).json({
        success: true,
        message: "This staff member's scanning access is already revoked.",
      });
    }

    await permission.update({ isActive: false });

    return res.status(200).json({
      success: true,
      message: "Staff scanning access revoked successfully.",
      scanner: {
        id: permission.id,
        userId: permission.userId,
        isActive: permission.isActive,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// List all scanner permissions belonging to the current school.
export const getAuthorizedScanners = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;
    const managerId = req.user?.id;

    await getActiveScannerManager(schoolId, managerId);

    const permissions = await GateScanner.findAll({
      where: { schoolId },
      order: [["createdAt", "DESC"]],
    });

    if (permissions.length === 0) {
      return res.status(200).json({
        success: true,
        total: 0,
        scanners: [],
      });
    }

    const userIds = [
      ...new Set(permissions.map((permission) => permission.userId)),
    ];

    const staffMembers = await User.findAll({
      where: {
        id: { [Op.in]: userIds },
        schoolId,
      },
      attributes: [
        "id",
        "firstName",
        "surName",
        "loginId",
        "role",
        "status",
      ],
    });

    const staffMap = new Map(
      staffMembers.map((staff) => [staff.id, staff])
    );

    const scanners = permissions.map((permission) => {
      const staff = staffMap.get(permission.userId);

      return {
        id: permission.id,
        userId: permission.userId,
        firstName: staff?.firstName ?? null,
        surName: staff?.surName ?? null,
        loginId: staff?.loginId ?? null,
        role: staff?.role ?? null,
        accountStatus: staff?.status ?? null,
        isActive: permission.isActive,
        createdAt: permission.createdAt,
        updatedAt: permission.updatedAt,
      };
    });

    return res.status(200).json({
      success: true,
      total: scanners.length,
      scanners,
    });
  } catch (error) {
    return next(error);
  }
};


export const getScanHistory = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!schoolId || !userId) {
      throw new AppError("Authentication is required.", 401);
    }

    const {
      startDate: requestedStartDate,
      endDate: requestedEndDate,
      scanType = "ALL",
      search = "",
      myScans = false,
      page = 1,
      limit = 20,
    } = req.query;

    const managementRoles = [
      "LEADER",
      "VICE_LEADER",
      "ADMINISTRATOR",
    ];

    const isSecurity = role === "SECURITY";
    const isManagement = managementRoles.includes(role);

    // Security and management have direct access.
    // Other staff need an active scanner permission.
    if (!isSecurity && !isManagement) {
      const scannerPermission = await GateScanner.findOne({
        where: {
          schoolId,
          userId,
          isActive: true,
        },
        attributes: ["id"],
      });

      if (!scannerPermission) {
        throw new AppError(
          "You are not authorized to view gate scan history.",
          403
        );
      }
    }

    // Determine the default date using the school's timezone.
    const todayParts = getZonedDateParts(
      new Date(),
      SCHOOL_TIME_ZONE
    );

    const today = [
      todayParts.year,
      String(todayParts.month).padStart(2, "0"),
      String(todayParts.day).padStart(2, "0"),
    ].join("-");

    const startDate = requestedStartDate || requestedEndDate || today;
    const endDate = requestedEndDate || requestedStartDate || today;

    const [startYear, startMonth, startDay] = startDate
      .split("-")
      .map(Number);

    const [endYear, endMonth, endDay] = endDate
      .split("-")
      .map(Number);

    const start = localMidnightToUTC(
      startYear,
      startMonth,
      startDay,
      SCHOOL_TIME_ZONE
    );

    // Exclusive upper bound: midnight after the selected end date.
    const nextEndDate = new Date(
      Date.UTC(endYear, endMonth - 1, endDay + 1)
    );

    const end = localMidnightToUTC(
      nextEndDate.getUTCFullYear(),
      nextEndDate.getUTCMonth() + 1,
      nextEndDate.getUTCDate(),
      SCHOOL_TIME_ZONE
    );

    const where = {
      schoolId,
      scannedAt: {
        [Op.gte]: start,
        [Op.lt]: end,
      },
    };

    if (scanType !== "ALL") {
      where.scanType = scanType;
    }

    // Only SECURITY users can activate the personal-scans filter.
    if (isSecurity && myScans) {
      where.scannedByUserId = userId;
    }

    const trimmedSearch = search.trim();

    const studentInclude = {
      model: Student,
      as: "student",
      attributes: [
        "id",
        "admissionNumber",
        "gender",
        "currentClassId",
      ],
      required: Boolean(trimmedSearch),
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "firstName", "surName"],
          required: false,
        },
        {
          model: Class,
          as: "currentClass",
          attributes: ["id", "classLevel", "arm"],
          required: false,
        },
      ],
    };

    if (trimmedSearch) {
      where[Op.or] = [
        {
          "$student.admissionNumber$": {
            [Op.iLike]: `%${trimmedSearch}%`,
          },
        },
        {
          "$student.user.firstName$": {
            [Op.iLike]: `%${trimmedSearch}%`,
          },
        },
        {
          "$student.user.surName$": {
            [Op.iLike]: `%${trimmedSearch}%`,
          },
        },
      ];
    }

    const offset = (Number(page) - 1) * Number(limit);

    const { count, rows } = await GateScanRecord.findAndCountAll({
      where,
      attributes: [
        "id",
        "studentId",
        "scannedByUserId",
        "scanType",
        "scannedAt",
      ],
      include: [
        studentInclude,
        {
          model: User,
          as: "scannedBy",
          attributes: ["id", "firstName", "surName", "role"],
          required: true,
        },
      ],
      order: [
        ["scannedAt", "DESC"],
        ["id", "DESC"],
      ],
      limit: Number(limit),
      offset,
      distinct: true,
    });

    return res.status(200).json({
      success: true,
      message: "Gate scan history retrieved successfully.",
      data: rows,
      pagination: {
        totalItems: count,
        currentPage: Number(page),
        pageSize: Number(limit),
        totalPages: Math.ceil(count / Number(limit)),
      },
      filters: {
        startDate,
        endDate,
        scanType,
        search: trimmedSearch,
        myScans: isSecurity && myScans,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getSecurityDashboard = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!schoolId || !userId) {
      throw new AppError("Authentication is required.", 401);
    }

    const managementRoles = [
      "LEADER",
      "VICE_LEADER",
      "ADMINISTRATOR",
    ];

    const isSecurity = role === "SECURITY";
    const isManagement = managementRoles.includes(role);

    // Security and management have direct access.
    // Other staff must have active scanner permission.
    if (!isSecurity && !isManagement) {
      const scannerPermission = await GateScanner.findOne({
        where: {
          schoolId,
          userId,
          isActive: true,
        },
        attributes: ["id"],
      });

      if (!scannerPermission) {
        throw new AppError(
          "You are not authorized to access the security dashboard.",
          403
        );
      }
    }

    // Calculate today's boundaries in the school timezone.
    const { start, end } = getSchoolDayRange();

    const todayArrivalCount = await GateScanRecord.count({ 
      where: {
        schoolId,
        scanType: "ARRIVAL",
        scannedAt: {
          [Op.gte]: start,
          [Op.lt]: end,
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Security dashboard retrieved successfully.",
      data: {
        todayArrivalCount,
      },
    });
  } catch (error) {
    next(error);
  }
};