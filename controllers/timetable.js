import PDFDocument from "pdfkit";
import {
  School,
  Class,
  Subject,
  User,
  WorkingDay,
  TimetablePeriod,
  TimetableLesson,
  Student,
  Parent,
  ParentStudent,
} from "../relationships/associations.js";

import { dbConnection } from "../config/db.js";
import { Op } from "sequelize";
import AppError from "../utils/AppError.js";
import { handleControllerError } from "../utils/controllerError.js";

const VALID_DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

const ADMIN_VIEW_ROLES = [
  "LEADER",
  "VICE_LEADER",
  "ADMINISTRATOR",
  "EXAM_OFFICER",
];

const PERIOD_MANAGEMENT_ROLES = [
  "LEADER",
  "VICE_LEADER",
  "ADMINISTRATOR",
  "STAFF",
];

const TEACHER_ROLES = [
  "LEADER",
  "VICE_LEADER",
  "ADMINISTRATOR",
  "EXAM_OFFICER",
  "STAFF",
];

/*
|--------------------------------------------------------------------------
| Shared Helpers
|--------------------------------------------------------------------------
*/

const getSchoolId = (req) => {
  const schoolId = req.user?.schoolId;

  if (!schoolId) {
    throw new AppError("Authenticated school not found.", 401);
  }

  return schoolId;
};

const requireRole = (req, allowedRoles) => {
  if (!allowedRoles.includes(req.user?.role)) {
    throw new AppError(
      "You are not authorized to perform this action.",
      403
    );
  }
};

const getWorkingDays = async (schoolId, transaction) => {
  const config = await WorkingDay.findOne({
    where: { schoolId },
    transaction,
  });

  return Array.isArray(config?.days) ? config.days : [];
};

const validateWorkingDay = (dayOfWeek, workingDays) => {
  if (!VALID_DAYS.includes(dayOfWeek)) {
    throw new AppError("Please provide a valid day of the week.", 400);
  }

  if (!workingDays.includes(dayOfWeek)) {
    throw new AppError(
      `${dayOfWeek} is not configured as a working day for this school.`,
      400
    );
  }
};

const ensureClassBelongsToSchool = async (
  classId,
  schoolId,
  transaction
) => {
  const schoolClass = await Class.findOne({
    where: { id: classId, schoolId },
    transaction,
  });

  if (!schoolClass) {
    throw new AppError("Class not found for this school.", 404);
  }

  return schoolClass;
};

const ensurePeriodBelongsToSchool = async (
  periodId,
  schoolId,
  transaction
) => {
  const period = await TimetablePeriod.findOne({
    where: { id: periodId, schoolId },
    transaction,
  });

  if (!period) {
    throw new AppError("Timetable period not found.", 404);
  }

  return period;
};

const ensureSubjectBelongsToSchool = async (
  subjectId,
  schoolId,
  transaction
) => {
  const subject = await Subject.findOne({
    where: { id: subjectId, schoolId },
    transaction,
  });

  if (!subject) {
    throw new AppError("Subject not found for this school.", 404);
  }

  return subject;
};

const ensureTeacherBelongsToSchool = async (
  teacherId,
  schoolId,
  transaction
) => {
  if (!teacherId) return null;

  const teacher = await User.findOne({
    where: {
      id: teacherId,
      schoolId,
      role: { [Op.in]: TEACHER_ROLES },
    },
    transaction,
  });

  if (!teacher) {
    throw new AppError(
      "The selected teacher is not an eligible staff member of this school.",
      404
    );
  }

  return teacher;
};

/*
|--------------------------------------------------------------------------
| Class Access Authorization
|--------------------------------------------------------------------------
*/

// Form Masters can manage only the class currently assigned to them.
const ensureFormMasterAccess = async (
  user,
  schoolClass
) => {
  if (ADMIN_VIEW_ROLES.includes(user?.role)) {
    return;
  }
  if (
    user?.role !== "STAFF" ||
    schoolClass.formMasterId !== user.id
  ) {
    throw new AppError(
      "You are not the assigned Form Master for this class.",
      403
    );
  }
};

// Determines whether a user can view a particular class timetable.
const ensureCanViewClass = async (
  req,
  schoolClass,
  schoolId
) => {
  const user = req.user;

  // School leadership and Exam Officer can view all class timetables.
  if (ADMIN_VIEW_ROLES.includes(user.role)) {
    return;
  }

  // Form Masters can view their assigned class.
  if (user.role === "STAFF") {
    if (schoolClass.formMasterId === user.id) {
      return;
    }

    throw new AppError(
      "You are not authorized to view this class timetable.",
      403
    );
  }

  // Students can view only their current class timetable.
  if (user.role === "STUDENT") {
    const student = await Student.findOne({
      where: {
        schoolId,
        userId: user.id,
      },
    });

    if (
      !student ||
      !student.currentClassId ||
      student.currentClassId !== schoolClass.id
    ) {
      throw new AppError(
        "You can only view the timetable for your current class.",
        403
      );
    }

    return;
  }

  // Parents can view a timetable if they have a linked child
  // currently registered in the requested class.
  if (user.role === "PARENT") {
    const parent = await Parent.findOne({
      where: {
        schoolId,
        userId: user.id,
      },
    });

    if (!parent) {
      throw new AppError("Parent record not found.", 404);
    }

    const relationship = await ParentStudent.findOne({
      where: {
        parentId: parent.id,
      },
      include: [
        {
          model: Student,
          as: "student",
          where: {
            schoolId,
            currentClassId: schoolClass.id,
          },
          required: true,
        },
      ],
    });

    if (!relationship) {
      throw new AppError(
        "You are not authorized to view this class timetable.",
        403
      );
    }

    return;
  }

  throw new AppError(
    "You are not authorized to view timetables.",
    403
  );
};

const handleTimetableError = (error, next, req) => {
  if (
    error.name === "SequelizeUniqueConstraintError" ||
    error.name === "SequelizeExclusionConstraintError"
  ) {
    return next(
      new AppError(
        "This timetable entry conflicts with an existing record.",
        409
      )
    );
  }

  return handleControllerError(
    error,
    next,
    req,
    "TIMETABLE_CONTROLLER_ERROR",
    "Unable to process this request. Please try again."
  );
};

/*
|--------------------------------------------------------------------------
| Get Timetable
|--------------------------------------------------------------------------
*/

// GET /api/timetable?classId=<classId>
//
// Leadership and Exam Officer: any class.
// Form Master: assigned class only.
// Student: current class only.
// Parent: class of a linked child.

export const getTimetable = async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const { classId } = req.query;

    const schoolClass = await ensureClassBelongsToSchool(
      classId,
      schoolId
    );

    await ensureCanViewClass(req, schoolClass, schoolId);

    const isFormMaster =
      req.user.role === "STAFF" &&
      schoolClass.formMasterId === req.user.id;

    const [
      workingDays,
      periods,
      lessons,
      subjects,
      teachers,
    ] = await Promise.all([
      getWorkingDays(schoolId),

      TimetablePeriod.findAll({
        where: { schoolId },
        order: [
          ["orderIndex", "ASC"],
          ["createdAt", "ASC"],
        ],
      }),

      TimetableLesson.findAll({
        where: {
          schoolId,
          classId,
        },
        include: [
          {
            model: TimetablePeriod,
            as: "period",
          },
          {
            model: Subject,
            as: "subject",
          },
          {
            model: User,
            as: "teacher",
            attributes: ["id", "firstName", "surName"],
            required: false,
          },
        ],
      }),

      isFormMaster
        ? Subject.findAll({
            where: { schoolId },
            order: [["createdAt", "ASC"]],
          })
        : Promise.resolve([]),

      isFormMaster
        ? User.findAll({
            where: {
              schoolId,
              role: { [Op.in]: TEACHER_ROLES },
            },
            attributes: ["id", "firstName", "surName", "role"],
            order: [
              ["firstName", "ASC"],
              ["surName", "ASC"],
            ],
          })
        : Promise.resolve([]),
    ]);

    // Use the configured working-day order and period order.
    const dayOrder = workingDays.length > 0
      ? workingDays
      : VALID_DAYS;

    lessons.sort((a, b) => {
      const dayDifference =
        dayOrder.indexOf(a.dayOfWeek) -
        dayOrder.indexOf(b.dayOfWeek);

      if (dayDifference !== 0) {
        return dayDifference;
      }

      return (
        (a.period?.orderIndex ?? 0) -
        (b.period?.orderIndex ?? 0)
      );
    });

    return res.status(200).json({
      success: true,
      message: "Timetable retrieved successfully.",
      data: {
        class: {
          id: schoolClass.id,
          classLevel: schoolClass.classLevel,
          arm: schoolClass.arm,
        },
        workingDays,
        periods,
        lessons,
        subjects,
        teachers,
      },
    });
  } catch (error) {
    return handleTimetableError(error, next, req);
  }
};

/*
|--------------------------------------------------------------------------
| Create Period
|--------------------------------------------------------------------------
*/

// Shared school-wide period configuration.
// Only leadership and administrators can manage periods.

export const createPeriod = async (req, res, next) => {
  try {
    requireRole(req, PERIOD_MANAGEMENT_ROLES);

    const schoolId = getSchoolId(req);
    const { name, time } = req.body;

    const existingPeriod = await TimetablePeriod.findOne({
      where: {
        schoolId,
        name: name.trim(),
      },
    });

    if (existingPeriod) {
      throw new AppError(
        "A timetable period with this name already exists.",
        409
      );
    }

    const lastPeriod = await TimetablePeriod.findOne({
      where: { schoolId },
      order: [["orderIndex", "DESC"]],
    });

    const orderIndex = lastPeriod
      ? lastPeriod.orderIndex + 1
      : 0;

    const period = await TimetablePeriod.create({
      schoolId,
      name: name.trim(),
      time: time?.trim() || null,
      orderIndex,
    });

    return res.status(201).json({
      success: true,
      message: "Timetable period created successfully.",
      data: { period },
    });
  } catch (error) {
    return handleTimetableError(error, next, req);
  }
};

/*
|--------------------------------------------------------------------------
| Update Period
|--------------------------------------------------------------------------
*/

export const updatePeriod = async (req, res, next) => {
  try {
    requireRole(req, PERIOD_MANAGEMENT_ROLES);

    const schoolId = getSchoolId(req);
    const { periodId } = req.params;
    const { name, time } = req.body;

    const period = await TimetablePeriod.findOne({
      where: {
        id: periodId,
        schoolId,
      },
    });

    if (!period) {
      throw new AppError("Timetable period not found.", 404);
    }

    if (name !== undefined) {
      const duplicatePeriod = await TimetablePeriod.findOne({
        where: {
          schoolId,
          name: name.trim(),
          id: { [Op.ne]: period.id },
        },
      });

      if (duplicatePeriod) {
        throw new AppError(
          "A timetable period with this name already exists.",
          409
        );
      }
    }

    const updates = {};

    if (name !== undefined) {
      updates.name = name.trim();
    }

    if (time !== undefined) {
      updates.time = time?.trim() || null;
    }

    await period.update(updates);

    return res.status(200).json({
      success: true,
      message: "Timetable period updated successfully.",
      data: { period },
    });
  } catch (error) {
    return handleTimetableError(error, next, req);
  }
};

/*
|--------------------------------------------------------------------------
| Delete Period
|--------------------------------------------------------------------------
*/

// Deleting a shared period deletes its lessons across all classes.
// All operations happen in one transaction.

export const deletePeriod = async (req, res, next) => {
  let transaction;

  try {
    requireRole(req, PERIOD_MANAGEMENT_ROLES);

    transaction = await dbConnection.transaction();

    const schoolId = getSchoolId(req);
    const { periodId } = req.params;

    const period = await TimetablePeriod.findOne({
      where: {
        id: periodId,
        schoolId,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!period) {
      throw new AppError("Timetable period not found.", 404);
    }

    const deletedLessonCount = await TimetableLesson.destroy({
      where: {
        schoolId,
        periodId: period.id,
      },
      transaction,
    });

    await period.destroy({ transaction });

    const remainingPeriods = await TimetablePeriod.findAll({
      where: { schoolId },
      order: [
        ["orderIndex", "ASC"],
        ["createdAt", "ASC"],
      ],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    for (let index = 0; index < remainingPeriods.length; index++) {
      if (remainingPeriods[index].orderIndex !== index) {
        await remainingPeriods[index].update(
          { orderIndex: index },
          { transaction }
        );
      }
    }

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message:
        "Timetable period and its associated lessons deleted successfully.",
      data: {
        deletedPeriodId: period.id,
        deletedLessonCount,
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    return handleTimetableError(error, next, req);
  }
};

/*
|--------------------------------------------------------------------------
| Create Lesson
|--------------------------------------------------------------------------
*/

// Only the assigned Form Master can create a lesson for a class.

export const createLesson = async (req, res, next) => {
  let transaction;

  try {
    transaction = await dbConnection.transaction();

    const schoolId = getSchoolId(req);
    const {
      classId,
      periodId,
      dayOfWeek,
      subjectId,
      teacherId,
    } = req.body;

    const schoolClass = await ensureClassBelongsToSchool(
      classId,
      schoolId,
      transaction
    );

    await ensureFormMasterAccess(req.user, schoolClass);

    const workingDays = await getWorkingDays(
      schoolId,
      transaction
    );

    if (workingDays.length === 0) {
      throw new AppError(
        "Please configure the school's working days before creating a timetable.",
        400
      );
    }

    validateWorkingDay(dayOfWeek, workingDays);

    await ensurePeriodBelongsToSchool(
      periodId,
      schoolId,
      transaction
    );

    await ensureSubjectBelongsToSchool(
      subjectId,
      schoolId,
      transaction
    );

    await ensureTeacherBelongsToSchool(
      teacherId,
      schoolId,
      transaction
    );

    const existingLesson = await TimetableLesson.findOne({
      where: {
        schoolId,
        classId,
        periodId,
        dayOfWeek,
      },
      transaction,
    });

    if (existingLesson) {
      throw new AppError(
        "This class already has a lesson assigned to that day and period.",
        409
      );
    }

    const lesson = await TimetableLesson.create(
      {
        schoolId,
        classId,
        periodId,
        dayOfWeek,
        subjectId,
        teacherId: teacherId || null,
      },
      { transaction }
    );

    await transaction.commit();

    const createdLesson = await TimetableLesson.findOne({
      where: {
        id: lesson.id,
        schoolId,
      },
      include: [
        { model: TimetablePeriod, as: "period" },
        { model: Subject, as: "subject" },
        {
          model: User,
          as: "teacher",
          attributes: ["id", "firstName", "surName"],
          required: false,
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Timetable lesson created successfully.",
      data: { lesson: createdLesson },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    return handleTimetableError(error, next, req);
  }
};

/*
|--------------------------------------------------------------------------
| Update Lesson
|--------------------------------------------------------------------------
*/

// A Form Master can update only lessons belonging to their assigned class.
// A lesson cannot be moved to another class through this endpoint.

export const updateLesson = async (req, res, next) => {
  let transaction;

  try {
    transaction = await dbConnection.transaction();

    const schoolId = getSchoolId(req);
    const { lessonId } = req.params;

    const {
      periodId,
      dayOfWeek,
      subjectId,
      teacherId,
    } = req.body;

    const lesson = await TimetableLesson.findOne({
      where: {
        id: lessonId,
        schoolId,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!lesson) {
      throw new AppError("Timetable lesson not found.", 404);
    }

    const schoolClass = await ensureClassBelongsToSchool(
      lesson.classId,
      schoolId,
      transaction
    );

    await ensureFormMasterAccess(req.user, schoolClass);

    const nextPeriodId = periodId ?? lesson.periodId;
    const nextDayOfWeek = dayOfWeek ?? lesson.dayOfWeek;
    const nextSubjectId = subjectId ?? lesson.subjectId;

    const nextTeacherId =
      teacherId === undefined
        ? lesson.teacherId
        : teacherId;

    const workingDays = await getWorkingDays(
      schoolId,
      transaction
    );

    if (workingDays.length === 0) {
      throw new AppError(
        "Please configure the school's working days before updating a timetable.",
        400
      );
    }

    validateWorkingDay(nextDayOfWeek, workingDays);

    await ensurePeriodBelongsToSchool(
      nextPeriodId,
      schoolId,
      transaction
    );

    await ensureSubjectBelongsToSchool(
      nextSubjectId,
      schoolId,
      transaction
    );

    await ensureTeacherBelongsToSchool(
      nextTeacherId,
      schoolId,
      transaction
    );

    const conflictingLesson = await TimetableLesson.findOne({
      where: {
        schoolId,
        classId: lesson.classId,
        periodId: nextPeriodId,
        dayOfWeek: nextDayOfWeek,
        id: { [Op.ne]: lesson.id },
      },
      transaction,
    });

    if (conflictingLesson) {
      throw new AppError(
        "This class already has a lesson assigned to that day and period.",
        409
      );
    }

    await lesson.update(
      {
        periodId: nextPeriodId,
        dayOfWeek: nextDayOfWeek,
        subjectId: nextSubjectId,
        teacherId: nextTeacherId || null,
      },
      { transaction }
    );

    await transaction.commit();

    const updatedLesson = await TimetableLesson.findOne({
      where: {
        id: lesson.id,
        schoolId,
      },
      include: [
        { model: TimetablePeriod, as: "period" },
        { model: Subject, as: "subject" },
        {
          model: User,
          as: "teacher",
          attributes: ["id", "firstName", "surName"],
          required: false,
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Timetable lesson updated successfully.",
      data: { lesson: updatedLesson },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    return handleTimetableError(error, next, req);
  }
};

/*
|--------------------------------------------------------------------------
| Delete Lesson
|--------------------------------------------------------------------------
*/

// Only the assigned Form Master can delete a lesson.

export const deleteLesson = async (req, res, next) => {
  let transaction;

  try {
    transaction = await dbConnection.transaction();

    const schoolId = getSchoolId(req);
    const { lessonId } = req.params;

    const lesson = await TimetableLesson.findOne({
      where: {
        id: lessonId,
        schoolId,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!lesson) {
      throw new AppError("Timetable lesson not found.", 404);
    }

    const schoolClass = await ensureClassBelongsToSchool(
      lesson.classId,
      schoolId,
      transaction
    );

    await ensureFormMasterAccess(req.user, schoolClass);

    await lesson.destroy({ transaction });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Timetable lesson deleted successfully.",
      data: {
        deletedLessonId: lesson.id,
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    return handleTimetableError(error, next, req);
  }
};

/*
|--------------------------------------------------------------------------
| Get School Working Days
|--------------------------------------------------------------------------
*/

export const getSchoolWorkingDays = async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const workingDays = await getWorkingDays(schoolId);

    return res.status(200).json({
      success: true,
      message: "Working days retrieved successfully.",
      data: {
        workingDays: workingDays.length > 0 ? workingDays : VALID_DAYS,
      },
    });
  } catch (error) {
    return handleTimetableError(error, next, req);
  }
};

/*
|--------------------------------------------------------------------------
| Generate Timetable PDF (PDFKit)
|--------------------------------------------------------------------------
*/

export const generateTimetablePdf = async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const { classId } = req.query;

    const schoolClass = await ensureClassBelongsToSchool(classId, schoolId);
    await ensureCanViewClass(req, schoolClass, schoolId);

    const [school, workingDays, periods, lessons] = await Promise.all([
      School.findByPk(schoolId),
      getWorkingDays(schoolId),
      TimetablePeriod.findAll({
        where: { schoolId },
        order: [
          ["orderIndex", "ASC"],
          ["createdAt", "ASC"],
        ],
      }),
      TimetableLesson.findAll({
        where: { schoolId, classId },
        include: [
          { model: TimetablePeriod, as: "period" },
          { model: Subject, as: "subject" },
          {
            model: User,
            as: "teacher",
            attributes: ["id", "firstName", "surName"],
            required: false,
          },
        ],
      }),
    ]);

    const activeDays = workingDays.length > 0 ? workingDays : VALID_DAYS;

    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 30,
      info: {
        Title: `${schoolClass.classLevel} ${schoolClass.arm} Timetable`,
        Author: school?.name || "ScholaNode",
      },
    });

    const isDownload = req.query.download === "true";
    const safeLevel = (schoolClass.classLevel || "").replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeArm = (schoolClass.arm || "").replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `${safeLevel}_${safeArm}_Timetable.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `${isDownload ? "attachment" : "inline"}; filename="${filename}"`
    );

    doc.pipe(res);

    const primaryColor = "#071A52";
    const accentColor = "#123A8F";
    const lightBg = "#F8FAFC";
    const borderColor = "#CBD5E1";
    const mutedColor = "#64748B";

    // Header title
    const schoolName = (school?.name || "SCHOLANODE ACADEMY").toUpperCase();
    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .fillColor(primaryColor)
      .text(schoolName, { align: "center" });

    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .fillColor(accentColor)
      .text(`CLASS TIMETABLE: ${schoolClass.classLevel.toUpperCase()} ${schoolClass.arm ? "- " + schoolClass.arm.toUpperCase() : ""}`, {
        align: "center",
      });

    doc.moveDown(0.5);

    // Layout calculations
    const startX = 30;
    const startY = doc.y + 4;
    const totalWidth = 842 - 60; // 782pt
    const periodColWidth = Math.min(110, Math.floor(totalWidth * 0.15));
    const dayColWidth = Math.floor((totalWidth - periodColWidth) / activeDays.length);
    const headerHeight = 26;

    // Header row background
    doc.rect(startX, startY, totalWidth, headerHeight).fill(primaryColor);

    // Period / Time header cell
    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("#FFFFFF")
      .text("TIME / PERIOD", startX + 4, startY + 8, {
        width: periodColWidth - 8,
        align: "center",
      });

    // Days header cells
    activeDays.forEach((day, index) => {
      const x = startX + periodColWidth + index * dayColWidth;
      const formattedDay = day.charAt(0) + day.slice(1).toLowerCase();
      doc.text(formattedDay, x + 4, startY + 8, {
        width: dayColWidth - 8,
        align: "center",
      });
    });

    let currentY = startY + headerHeight;
    const availableHeight = 520 - currentY;
    const rowHeight = Math.max(38, Math.min(65, Math.floor(availableHeight / Math.max(periods.length, 1))));

    periods.forEach((period, pIndex) => {
      const isEven = pIndex % 2 === 0;
      doc
        .rect(startX, currentY, totalWidth, rowHeight)
        .fill(isEven ? "#FFFFFF" : lightBg);

      // Period Name & Time
      doc
        .fontSize(9)
        .font("Helvetica-Bold")
        .fillColor(primaryColor)
        .text(period.name, startX + 4, currentY + 6, {
          width: periodColWidth - 8,
          align: "center",
        });

      if (period.time) {
        doc
          .fontSize(7.5)
          .font("Helvetica")
          .fillColor(mutedColor)
          .text(period.time, startX + 4, currentY + 20, {
            width: periodColWidth - 8,
            align: "center",
          });
      }

      // Lesson cells
      activeDays.forEach((day, dIndex) => {
        const x = startX + periodColWidth + dIndex * dayColWidth;
        const lesson = lessons.find(
          (l) => l.periodId === period.id && l.dayOfWeek === day
        );

        if (lesson) {
          doc
            .rect(x + 2, currentY + 2, dayColWidth - 4, rowHeight - 4)
            .fillAndStroke("#EFF6FF", "#BFDBFE");

          doc
            .fontSize(8.5)
            .font("Helvetica-Bold")
            .fillColor(primaryColor)
            .text(lesson.subject?.name || "Subject", x + 4, currentY + 6, {
              width: dayColWidth - 8,
              align: "center",
              ellipsis: true,
            });

          const teacherName = lesson.teacher
            ? `${lesson.teacher.firstName || ""} ${lesson.teacher.surName || ""}`.trim()
            : "";

          if (teacherName) {
            doc
              .fontSize(7)
              .font("Helvetica")
              .fillColor(mutedColor)
              .text(teacherName, x + 4, currentY + 22, {
                width: dayColWidth - 8,
                align: "center",
                ellipsis: true,
              });
          }
        }
      });

      currentY += rowHeight;
    });

    // Grid borders
    doc
      .rect(startX, startY, totalWidth, currentY - startY)
      .stroke(borderColor);

    for (let i = 1; i < activeDays.length + 1; i++) {
      const lineX = startX + periodColWidth + (i - 1) * dayColWidth;
      doc
        .moveTo(lineX, startY)
        .lineTo(lineX, currentY)
        .stroke(borderColor);
    }

    // Footer note
    const footerY = 555;
    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor(mutedColor)
      .text(
        `Generated on ${new Date().toLocaleDateString(undefined, { dateStyle: "long" })} | ScholaNode School Management System`,
        startX,
        footerY,
        { width: totalWidth, align: "center" }
      );

    doc.end();
  } catch (error) {
    return handleTimetableError(error, next, req);
  }
};
