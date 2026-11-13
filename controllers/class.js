import { handleControllerError } from "../utils/controllerError.js";
import { Class, User, Student, Session, Term, AttendanceRegister, ClassSubject, TimetableLesson } from "../relationships/associations.js";
import {
  canonicalizeClassLevel,
  canonicalizeArm,
  inferEducationSection,
  normalizeOrInferEducationSection,
} from "../utils/classCanonical.js";
import AppError from "../utils/AppError.js";
import {dbConnection} from "../config/db.js";
import { Op } from "sequelize";
import { serializeStaffProfile } from "../utils/pendingProfile.js";

// Get all classes belonging to the authenticated school
export const getSchoolClasses = async (req, res, next) => {
  try {
    // 1. Get authenticated school
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return next(
        new AppError("Authenticated school not found.", 401)
      );
    }

    // 2. Get all classes with their form masters and students
    const classes = await Class.findAll({
      where: {
        schoolId,
      },

      attributes: [
        "id",
        "schoolId",
        "classLevel",
        "arm",
        "formMasterId",
        "createdAt",
        "updatedAt",
      ],

      include: [
  {
    model: User,
    as: "formMaster",
    attributes: [
      "id",
      "loginId",
      "firstName",
      "surName",
      "email",
      "role",
    ],
    required: false,
  },
],
      order: [
        ["classLevel", "ASC"],
        ["arm", "ASC"],
      ],
    });

    // 3. Success response
    return res.status(200).json({
      success: true,
      message: "Classes retrieved successfully.",
      count: classes.length,
      data: {
        classes: classes.map((record) => {
          const classItem = record.toJSON();

          return classItem.formMaster
            ? {
                ...classItem,
                formMaster: serializeStaffProfile(classItem.formMaster),
              }
            : classItem;
        }),
      },
    });
  } catch (error) {
    return handleControllerError(error, next, req, "CLASS_CONTROLLER_ERROR", "Unable to process this request. Please try again.");
  }
};

export const assignFormMaster = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;
    const role = req.user?.role;
    const { classId } = req.params;
    const { formMasterId } = req.body;

    // 1. Verify authenticated school
    if (!schoolId) {
      return next(
        new AppError("Authenticated school not found.", 401)
      );
    }

    // 2. Restrict who can manage assignments
    const allowedRoles = [
      "LEADER",
      "VICE_LEADER",
      "ADMINISTRATOR",
    ];

    if (!allowedRoles.includes(role)) {
      return next(
        new AppError(
          "You are not authorized to assign form masters.",
          403
        )
      );
    }

    // 3. Require the formMasterId property.
    // Use null to remove an existing assignment.
    if (
      !Object.prototype.hasOwnProperty.call(
        req.body,
        "formMasterId"
      )
    ) {
      return next(
        new AppError(
          "Form master ID is required. Use null to remove an assignment.",
          400
        )
      );
    }

    if (
      formMasterId !== null &&
      (typeof formMasterId !== "string" ||
        !formMasterId.trim())
    ) {
      return next(
        new AppError(
          "Form master ID must be a valid ID or null.",
          400
        )
      );
    }

    const updatedClass = await dbConnection.transaction(
      async (transaction) => {
        // 4. Find the class within the authenticated school
        const classRecord = await Class.findOne({
          where: {
            id: classId,
            schoolId,
          },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!classRecord) {
          throw new AppError(
            "Class not found for this school.",
            404
          );
        }

        // 5. If an ID was provided, verify eligible staff
        if (formMasterId !== null) {
          const normalizedFormMasterId = formMasterId.trim();

          const formMaster = await User.findOne({
            where: {
              id: normalizedFormMasterId,
              schoolId,
              role: "STAFF",
              status: "ACTIVE",
            },
            attributes: [
              "id",
              "firstName",
              "surName",
              "loginId",
            ],
            transaction,
          });

          if (!formMaster) {
            throw new AppError(
              "The selected form master is not an active staff member of this school.",
              400
            );
          }

          // 6. Ensure this staff member is not assigned
          // as form master to another class.
          const existingAssignment = await Class.findOne({
            where: {
              schoolId,
              formMasterId: normalizedFormMasterId,
              id: {
                [Op.ne]: classRecord.id,
              },
            },
            attributes: ["id", "classLevel", "arm"],
            transaction,
          });

          if (existingAssignment) {
            throw new AppError(
              "This staff member is already assigned as a form master to another class.",
              409
            );
          }
        }

        // 7. Assign, change, or remove the form master
        await classRecord.update(
          {
            formMasterId:
              formMasterId === null
                ? null
                : formMasterId.trim(),
          },
          { transaction }
        );

        // 8. Return the updated class with its form master
        return Class.findByPk(classRecord.id, {
          attributes: [
            "id",
            "schoolId",
            "classLevel",
            "arm",
            "formMasterId",
          ],
          include: [
            {
              model: User,
              as: "formMaster",
              attributes: [
                "id",
                "firstName",
                "surName",
                "email",
                "loginId",
              ],
              required: false,
            },
          ],
          transaction,
        });
      }
    );

    const classPayload = updatedClass.toJSON();

    if (classPayload.formMaster) {
      classPayload.formMaster = serializeStaffProfile(classPayload.formMaster);
    }

    return res.status(200).json({
      success: true,
      message: updatedClass.formMaster
        ? "Form master assigned successfully."
        : "Form master assignment removed successfully.",
      data: {
        class: classPayload,
      },
    });
  } catch (error) {
    return handleControllerError(error, next, req, "CLASS_CONTROLLER_ERROR", "Unable to process this request. Please try again.");
  }
};

const ACADEMIC_TIME_ZONE = "Africa/Lagos";

const lagosDateKey = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: ACADEMIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

export const getMyClassDetails = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;
    const userId = req.user?.id;

    if (!schoolId || !userId) {
      return next(
        new AppError("Authenticated school or user not found.", 401)
      );
    }

    // =========================================
    // 1. VERIFY ACTIVE FORM MASTER
    // =========================================

    const formMasterUser = await User.findOne({
      where: {
        id: userId,
        schoolId,
        role: "STAFF",
        status: "ACTIVE",
      },
      attributes: ["id", "firstName", "surName", "email"],
    });

    if (!formMasterUser) {
      return next(
        new AppError(
          "Only active staff members can access My Class.",
          403
        )
      );
    }

    // =========================================
    // 2. FIND ASSIGNED CLASS
    // =========================================

    const assignedClasses = await Class.findAll({
      where: {
        schoolId,
        formMasterId: userId,
      },
      include: [
        {
          model: User,
          as: "formMaster",
          attributes: ["id", "firstName", "surName", "email"],
          required: false,
        },
      ],
    });

    if (assignedClasses.length === 0) {
      return next(
        new AppError(
          "You are not currently assigned as a Form Master to any class.",
          403
        )
      );
    }

    if (assignedClasses.length > 1) {
      return next(
        new AppError(
          "You are assigned to multiple classes. Please contact your school administrator to resolve this assignment.",
          409
        )
      );
    }

    const targetClass = assignedClasses[0];

    // =========================================
    // 3. CURRENT ACADEMIC SESSION AND TERM
    // =========================================

    const currentSession = await Session.findOne({
      where: {
        schoolId,
        status: "ACTIVE",
        isCurrent: true,
      },
    });

    const currentTerm = currentSession
      ? await Term.findOne({
          where: {
            schoolId,
            sessionId: currentSession.id,
            status: "ACTIVE",
            isCurrent: true,
          },
        })
      : null;

    // =========================================
    // 4. GET ACTIVE STUDENTS
    // =========================================

    const students = await Student.findAll({
      where: {
        schoolId,
        currentClassId: targetClass.id,
        admissionStatus: "ACTIVE",
      },
      attributes: [
        "id",
        "userId",
        "admissionNumber",
        "gender",
        "dateOfBirth",
        "enrollmentDate",
        "admissionStatus",
        "qrToken",
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
            "profileImageKey",
          ],
          required: true,
        },
      ],
      order: [
        ["admissionNumber", "ASC"],
        ["createdAt", "ASC"],
      ],
    });

    // =========================================
    // 5. GET TODAY'S ATTENDANCE REGISTER
    // =========================================

    const todayStr = lagosDateKey();

    const todayRegister = await AttendanceRegister.findOne({
      where: {
        schoolId,
        classId: targetClass.id,
        attendanceDate: todayStr,
      },
    });

    // =========================================
    // 6. CALCULATE ATTENDANCE COUNTS
    // =========================================

    let presentCount = 0;
    let absentCount = 0;
    let unconfirmedCount = 0;

    if (todayRegister) {
      const [present, absent, unconfirmed] = await Promise.all([
        AttendanceRecord.count({
          where: {
            attendanceRegisterId: todayRegister.id,
            status: "PRESENT",
          },
        }),

        AttendanceRecord.count({
          where: {
            attendanceRegisterId: todayRegister.id,
            status: "ABSENT",
          },
        }),

        AttendanceRecord.count({
          where: {
            attendanceRegisterId: todayRegister.id,
            status: null,
          },
        }),
      ]);

      presentCount = present;
      absentCount = absent;
      unconfirmedCount = unconfirmed;
    }

    const totalStudents = students.length;
    const confirmedCount = presentCount + absentCount;

    const attendancePercentage =
      confirmedCount > 0
        ? Math.round((presentCount / confirmedCount) * 100)
        : 0;

    // =========================================
    // 7. RESPONSE
    // =========================================

    return res.status(200).json({
      success: true,
      message: "Class details retrieved successfully.",

      data: {
        class: {
          id: targetClass.id,
          classLevel: targetClass.classLevel,
          arm: targetClass.arm,
        },

        academicPeriod: {
          sessionName: currentSession?.sessionName || null,
          termName: currentTerm?.termName || null,
        },

        formMaster: targetClass.formMaster
          ? {
              id: targetClass.formMaster.id,
              firstName: targetClass.formMaster.firstName,
              surName: targetClass.formMaster.surName,
              email: targetClass.formMaster.email,
            }
          : null,

        attendanceToday: {
          attendanceDate: todayStr,
          isMarked: Boolean(todayRegister),

          status: todayRegister?.status || "NOT_STARTED",

          presentCount,
          absentCount,
          unconfirmedCount,

          confirmedCount,
          totalStudents,

          percentage: attendancePercentage,
        },

        students: students.map((s) => ({
          id: s.id,

          name: `${s.user?.firstName || ""} ${
            s.user?.surName || ""
          }`.trim(),

          firstName: s.user?.firstName,
          surName: s.user?.surName,

          admissionNo: s.admissionNumber,

          gender:
            s.gender === "MALE"
              ? "Male"
              : s.gender === "FEMALE"
                ? "Female"
                : "Not specified",

          rawGender: s.gender,

          status: s.admissionStatus,

          qrToken: s.qrToken,

          profileImageKey: s.user?.profileImageKey,

          dateOfBirth: s.dateOfBirth,
        })),
      },
    });
  } catch (error) {
    return handleControllerError(
      error,
      next,
      req,
      "CLASS_CONTROLLER_ERROR",
      "Unable to process this request. Please try again."
    );
  }
};


// Update a class (level, arm, educational section)
export const updateClass = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;
    const { classId } = req.params;
    const { classLevel, arm, educationSection } = req.body;

    if (!schoolId) {
      return next(new AppError("Authenticated school not found.", 401));
    }

    if (!classId) {
      return next(new AppError("Class ID is required.", 400));
    }

    const classRecord = await Class.findOne({
      where: {
        id: classId,
        schoolId,
      },
    });

    if (!classRecord) {
      return next(new AppError("Class record not found for this school.", 404));
    }

    const canonicalLevel =
      classLevel !== undefined
        ? canonicalizeClassLevel(classLevel)
        : classRecord.classLevel;

    const canonicalArm =
      arm !== undefined ? canonicalizeArm(arm) : classRecord.arm;

    const canonicalSection =
      educationSection !== undefined
        ? normalizeOrInferEducationSection(educationSection, canonicalLevel)
        : (classRecord.educationSection || inferEducationSection(canonicalLevel));

    if (!canonicalLevel) {
      return next(new AppError("Class level cannot be empty.", 400));
    }

    // Check duplicate collision in the same school
    const existingDuplicate = await Class.findOne({
      where: {
        schoolId,
        classLevel: canonicalLevel,
        arm: canonicalArm,
        id: { [Op.ne]: classId },
      },
    });

    if (existingDuplicate) {
      return next(
        new AppError(
          `A class with level "${canonicalLevel}" and arm "${canonicalArm || 'ungrouped'}" already exists for this school.`,
          409
        )
      );
    }

    classRecord.classLevel = canonicalLevel;
    classRecord.arm = canonicalArm;
    classRecord.educationSection = canonicalSection;
    await classRecord.save();

    return res.status(200).json({
      status: "success",
      message: "Class updated successfully.",
      data: {
        class: classRecord,
      },
    });
  } catch (error) {
    return handleControllerError(
      error,
      next,
      req,
      "UPDATE_CLASS_ERROR",
      "Unable to update this class. Please try again."
    );
  }
};

// Delete a class (with safety checks for enrolled students and attendance)
export const deleteClass = async (req, res, next) => {
  let transaction;

  try {
    const schoolId = req.user?.schoolId;
    const { classId } = req.params;

    if (!schoolId) {
      return next(new AppError("Authenticated school not found.", 401));
    }

    if (!classId) {
      return next(new AppError("Class ID is required.", 400));
    }

    const classRecord = await Class.findOne({
      where: {
        id: classId,
        schoolId,
      },
    });

    if (!classRecord) {
      return next(new AppError("Class record not found for this school.", 404));
    }

    // 1. Check if students are currently enrolled in this class
    const studentCount = await Student.count({
      where: {
        currentClassId: classId,
      },
    });

    if (studentCount > 0) {
      return next(
        new AppError(
          `Cannot delete "${classRecord.classLevel}${classRecord.arm ? ` · ${classRecord.arm}` : ''}". There are currently ${studentCount} student(s) enrolled in this class. Please reassign or transfer students before deleting, or use Edit to update the class details.`,
          400
        )
      );
    }

    // 2. Check if attendance registers exist for this class
    const attendanceCount = await AttendanceRegister.count({
      where: {
        classId,
      },
    });

    if (attendanceCount > 0) {
      return next(
        new AppError(
          `Cannot delete "${classRecord.classLevel}${classRecord.arm ? ` · ${classRecord.arm}` : ''}" because daily attendance records are attached to it. Renaming is recommended to preserve attendance history.`,
          400
        )
      );
    }

    // 3. Clean up junction/dependent entries and delete atomically
    transaction = await dbConnection.transaction();

    if (ClassSubject) {
      await ClassSubject.destroy({ where: { classId }, transaction });
    }
    if (TimetableLesson) {
      await TimetableLesson.destroy({ where: { classId }, transaction });
    }

    await classRecord.destroy({ transaction });

    await transaction.commit();

    return res.status(200).json({
      status: "success",
      message: "Class deleted successfully.",
    });
  } catch (error) {
    if (transaction) await transaction.rollback();
    return handleControllerError(
      error,
      next,
      req,
      "DELETE_CLASS_ERROR",
      "Unable to delete this class. Please try again."
    );
  }
};
