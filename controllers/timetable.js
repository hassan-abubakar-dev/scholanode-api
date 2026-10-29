import {
  Class,
  Subject,
  User,
  WorkingDay,
  TimetablePeriod,
  TimetableLesson,
} from "../relationships/associations.js";

import { dbConnection } from "../config/db.js";
import { Op } from "sequelize";
import AppError from "../utils/AppError.js";

const VALID_DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

const getSchoolId = (req) => {
  const schoolId = req.user?.schoolId;

  if (!schoolId) {
    throw new AppError("Authenticated school not found.", 401);
  }

  return schoolId;
};

const getWorkingDays = async (schoolId, transaction) => {
  const workingDayConfig = await WorkingDay.findOne({
    where: { schoolId },
    transaction,
  });

  return workingDayConfig?.days ?? [];
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
    where: { id: teacherId, schoolId },
    transaction,
  });

  if (!teacher) {
    throw new AppError("Teacher not found for this school.", 404);
  }

  return teacher;
};

const handleTimetableError = (error, next) => {
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

  return next(error);
};

/*
|--------------------------------------------------------------------------
| Get Timetable
|--------------------------------------------------------------------------
*/

// Returns shared periods and timetable data for one selected class.
export const getTimetable = async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const { classId } = req.query;

    await ensureClassBelongsToSchool(classId, schoolId);

    const [workingDays, periods, lessons, subjects] = await Promise.all([
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
        order: [
          ["dayOfWeek", "ASC"],
          ["createdAt", "ASC"],
        ],
      }),

      Subject.findAll({
        where: { schoolId },
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Timetable retrieved successfully.",
      data: {
        workingDays,
        periods,
        lessons,
        subjects,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| Create Period
|--------------------------------------------------------------------------
*/

export const createPeriod = async (req, res, next) => {
  try {
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

    const orderIndex = lastPeriod ? lastPeriod.orderIndex + 1 : 0;

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
    return handleTimetableError(error, next);
  }
};

/*
|--------------------------------------------------------------------------
| Update Period
|--------------------------------------------------------------------------
*/

// The period's name and time may change.
// Its orderIndex is not accepted from the frontend.
export const updatePeriod = async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const { periodId } = req.params;
    const { name, time } = req.body;

    const period = await TimetablePeriod.findOne({
      where: { id: periodId, schoolId },
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
    return handleTimetableError(error, next);
  }
};

/*
|--------------------------------------------------------------------------
| Delete Period
|--------------------------------------------------------------------------
*/

// Deletes the period and all its lessons across every class.
// Recalculates remaining orderIndex values within the same transaction.
export const deletePeriod = async (req, res, next) => {
  let transaction;

  try {
    transaction = await dbConnection.transaction();

    const schoolId = getSchoolId(req);
    const { periodId } = req.params;

    const period = await TimetablePeriod.findOne({
      where: { id: periodId, schoolId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!period) {
      throw new AppError("Timetable period not found.", 404);
    }

    // Delete all lessons associated with this period across the school.
    const deletedLessonCount = await TimetableLesson.destroy({
      where: {
        schoolId,
        periodId: period.id,
      },
      transaction,
    });

    // Delete the period.
    await period.destroy({ transaction });

    // Recalculate the order of the remaining periods.
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

    return handleTimetableError(error, next);
  }
};
/*
|--------------------------------------------------------------------------
| Create Lesson
|--------------------------------------------------------------------------
*/

export const createLesson = async (req, res, next) => {
  let transaction;

  try {
    transaction = await dbConnection.transaction();

    const schoolId = getSchoolId(req);
    const { classId, periodId, dayOfWeek, subjectId, teacherId } = req.body;

    const workingDays = await getWorkingDays(schoolId, transaction);
    validateWorkingDay(dayOfWeek, workingDays);

    await ensureClassBelongsToSchool(classId, schoolId, transaction);
    await ensurePeriodBelongsToSchool(periodId, schoolId, transaction);
    await ensureSubjectBelongsToSchool(subjectId, schoolId, transaction);
    await ensureTeacherBelongsToSchool(teacherId, schoolId, transaction);

    const existingLesson = await TimetableLesson.findOne({
      where: {
        schoolId,
        classId,
        periodId,
        dayOfWeek,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
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
      where: { id: lesson.id, schoolId },
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

    return handleTimetableError(error, next);
  }
};

/*
|--------------------------------------------------------------------------
| Update Lesson
|--------------------------------------------------------------------------
*/

export const updateLesson = async (req, res, next) => {
  let transaction;

  try {
    transaction = await dbConnection.transaction();

    const schoolId = getSchoolId(req);
    const { lessonId } = req.params;
    const { classId, periodId, dayOfWeek, subjectId, teacherId } = req.body;

    const lesson = await TimetableLesson.findOne({
      where: { id: lessonId, schoolId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!lesson) {
      throw new AppError("Timetable lesson not found.", 404);
    }

    const nextClassId = classId ?? lesson.classId;
    const nextPeriodId = periodId ?? lesson.periodId;
    const nextDayOfWeek = dayOfWeek ?? lesson.dayOfWeek;
    const nextSubjectId = subjectId ?? lesson.subjectId;
    const nextTeacherId =
      teacherId === undefined ? lesson.teacherId : teacherId;

    const workingDays = await getWorkingDays(schoolId, transaction);
    validateWorkingDay(nextDayOfWeek, workingDays);

    await ensureClassBelongsToSchool(
      nextClassId,
      schoolId,
      transaction
    );

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
        classId: nextClassId,
        periodId: nextPeriodId,
        dayOfWeek: nextDayOfWeek,
        id: { [Op.ne]: lesson.id },
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (conflictingLesson) {
      throw new AppError(
        "This class already has a lesson assigned to that day and period.",
        409
      );
    }

    await lesson.update(
      {
        classId: nextClassId,
        periodId: nextPeriodId,
        dayOfWeek: nextDayOfWeek,
        subjectId: nextSubjectId,
        teacherId: nextTeacherId || null,
      },
      { transaction }
    );

    await transaction.commit();

    const updatedLesson = await TimetableLesson.findOne({
      where: { id: lesson.id, schoolId },
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

    return handleTimetableError(error, next);
  }
};

/*
|--------------------------------------------------------------------------
| Delete Lesson
|--------------------------------------------------------------------------
*/

export const deleteLesson = async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const { lessonId } = req.params;

    const lesson = await TimetableLesson.findOne({
      where: { id: lessonId, schoolId },
    });

    if (!lesson) {
      throw new AppError("Timetable lesson not found.", 404);
    }

    await lesson.destroy();

    return res.status(200).json({
      success: true,
      message: "Timetable lesson deleted successfully.",
      data: { deletedLessonId: lesson.id },
    });
  } catch (error) {
    return next(error);
  }
};