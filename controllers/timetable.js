import PDFDocument from "pdfkit";
import { Op } from "sequelize";

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
  ClassSubject,
} from "../relationships/associations.js";

import { dbConnection } from "../config/db.js";
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
];

const TEACHER_ROLES = [
  "LEADER",
  "VICE_LEADER",
  "ADMINISTRATOR",
  "EXAM_OFFICER",
  "STAFF",
];

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const handleTimetableError = (error, next, req) => {
  const constraint =
    error?.constraint ||
    error?.parent?.constraint ||
    error?.index ||
    error?.parent?.index;
  const conflictFields = Object.keys(error?.fields || {});
  const isLessonConflict =
    constraint === "unique_timetable_lesson_slot" ||
    constraint === "unique_timetable_teacher_period" ||
    (conflictFields.includes("schoolId") &&
      conflictFields.includes("periodId") &&
      conflictFields.includes("dayOfWeek") &&
      (conflictFields.includes("classId") ||
        conflictFields.includes("teacherId")));

  if (
    error?.name === "SequelizeUniqueConstraintError" &&
    isLessonConflict
  ) {
    return next(
      new AppError(
        "The selected class slot or teacher schedule conflicts with another lesson.",
        409
      )
    );
  }

  return handleControllerError(
    error,
    next,
    req,
    "TIMETABLE_CONTROLLER_ERROR",
    "Unable to process the timetable request."
  );
};

/*
|--------------------------------------------------------------------------
| General Helpers
|--------------------------------------------------------------------------
*/

const getSchoolId = (req) => {
  const schoolId = req.user?.schoolId;

  if (!schoolId) {
    throw new AppError("School information could not be identified.", 403);
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

const getWorkingDays = async (schoolId, transaction = undefined) => {
  const record = await WorkingDay.findOne({
    where: { schoolId },
    attributes: ["days"],
    transaction,
  });

  return Array.isArray(record?.days) ? record.days : [];
};

const validateWorkingDay = (dayOfWeek, workingDays) => {
  if (!VALID_DAYS.includes(dayOfWeek)) {
    throw new AppError("Please provide a valid day of the week.", 400);
  }

  if (!workingDays.includes(dayOfWeek)) {
    throw new AppError(
      "This day is not configured as a working day for your school.",
      400
    );
  }
};

const ensureClassBelongsToSchool = async (
  classId,
  schoolId,
  transaction = undefined
) => {
  const schoolClass = await Class.findOne({
    where: {
      id: classId,
      schoolId,
    },
    transaction,
  });

  if (!schoolClass) {
    throw new AppError("Class not found.", 404);
  }

  return schoolClass;
};

const ensurePeriodBelongsToSchool = async (
  periodId,
  schoolId,
  transaction = undefined
) => {
  const period = await TimetablePeriod.findOne({
    where: {
      id: periodId,
      schoolId,
    },
    transaction,
  });

  if (!period) {
    throw new AppError("Timetable period not found.", 404);
  }

  return period;
};

const ensureSubjectBelongsToClass = async ({
  subjectId,
  classId,
  schoolId,
  transaction,
}) => {
  const classSubject = await ClassSubject.findOne({
    where: {
      schoolId,
      classId,
      subjectId,
    },
    include: [
      {
        model: Subject,
        as: "subject",
        required: true,
        where: {
          schoolId,
          isActive: true,
        },
        attributes: ["id", "subjectName", "isActive"],
      },
    ],
    transaction,
  });

  if (!classSubject) {
    throw new AppError(
      "This subject is not active or has not been assigned to this class.",
      400
    );
  }

  return classSubject.subject;
};

const ensureTeacherBelongsToSchool = async (
  teacherId,
  schoolId,
  transaction = undefined
) => {
  if (!teacherId) return null;

  const teacher = await User.findOne({
    where: {
      id: teacherId,
      schoolId,
      role: {
        [Op.in]: TEACHER_ROLES,
      },
      status: "ACTIVE",
    },
    attributes: ["id", "firstName", "surName", "role", "status"],
    transaction,
  });

  if (!teacher) {
    throw new AppError(
      "The selected teacher is not an active eligible staff member of this school.",
      400
    );
  }

  return teacher;
};

/*
|--------------------------------------------------------------------------
| Authorization Helpers
|--------------------------------------------------------------------------
*/

const ensureFormMasterAccess = async (
  user,
  schoolClass,
  transaction = undefined
) => {
  const activeStaff = await User.findOne({
    where: {
      id: user.id,
      schoolId: user.schoolId,
      role: "STAFF",
      status: "ACTIVE",
    },
    attributes: ["id"],
    transaction,
  });

  if (!activeStaff || schoolClass.formMasterId !== user.id) {
    throw new AppError(
      "Only the Form Master assigned to this class can configure its timetable.",
      403
    );
  }

  // Enforce the same one-class Form Master rule used by My Class.
  const assignedClasses = await Class.count({
    where: {
      schoolId: user.schoolId,
      formMasterId: user.id,
    },
    transaction,
  });

  if (assignedClasses !== 1) {
    throw new AppError(
      "Your Form Master assignment must be resolved before configuring a timetable.",
      409
    );
  }
};

const ensureCanViewClass = async (req, schoolClass, schoolId) => {
  const user = req.user;

  if (ADMIN_VIEW_ROLES.includes(user.role)) {
    return {
      canConfigure: false,
      accessRole: "ADMIN",
    };
  }

  if (
    user.role === "STAFF" &&
    schoolClass.formMasterId === user.id
  ) {
    const activeStaff = await User.findOne({
      where: {
        id: user.id,
        schoolId,
        role: "STAFF",
        status: "ACTIVE",
      },
      attributes: ["id"],
    });

    if (!activeStaff) {
      throw new AppError(
        "You are not authorized to view this class timetable.",
        403
      );
    }

    const assignedClasses = await Class.count({
      where: {
        schoolId,
        formMasterId: user.id,
      },
    });

    if (assignedClasses !== 1) {
      throw new AppError(
        "Your Form Master assignment must be resolved before configuring a timetable.",
        409
      );
    }

    return {
      canConfigure: true,
      accessRole: "FORM_MASTER",
    };
  }

  if (user.role === "STUDENT") {
    const student = await Student.findOne({
      where: {
        userId: user.id,
        schoolId,
        currentClassId: schoolClass.id,
        admissionStatus: "ACTIVE",
      },
      attributes: ["id"],
    });

    if (student) {
      return {
        canConfigure: false,
        accessRole: "STUDENT",
      };
    }
  }

  if (user.role === "PARENT") {
    const parent = await Parent.findOne({
      where: {
        userId: user.id,
        schoolId,
      },
      attributes: ["id"],
    });

    if (parent) {
      const relationship = await ParentStudent.findOne({
        where: {
          parentId: parent.id,
          schoolId,
        },
        include: [
          {
            model: Student,
            as: "student",
            required: true,
            where: {
              schoolId,
              currentClassId: schoolClass.id,
              admissionStatus: "ACTIVE",
            },
            attributes: ["id"],
          },
        ],
      });

      if (relationship) {
        return {
          canConfigure: false,
          accessRole: "PARENT",
        };
      }
    }
  }

  throw new AppError(
    "You are not authorized to view this class timetable.",
    403
  );
};

/*
|--------------------------------------------------------------------------
| Timetable Query Helpers
|--------------------------------------------------------------------------
*/

const getClassTimetableData = async (schoolClass, schoolId) => {
  const [workingDays, periods, lessons] = await Promise.all([
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
        classId: schoolClass.id,
      },
      include: [
        {
          model: TimetablePeriod,
          as: "period",
          attributes: ["id", "name", "time", "orderIndex"],
          required: true,
        },
        {
          model: Subject,
          as: "subject",
          attributes: ["id", "subjectName"],
          required: true,
        },
        {
          model: User,
          as: "teacher",
          attributes: ["id", "firstName", "surName"],
          required: false,
        },
      ],
    }),
  ]);

  const dayOrder = new Map(
    VALID_DAYS.map((day, index) => [day, index])
  );

  lessons.sort((a, b) => {
    const dayDifference =
      dayOrder.get(a.dayOfWeek) - dayOrder.get(b.dayOfWeek);

    if (dayDifference !== 0) return dayDifference;

    return (
      (a.period?.orderIndex ?? 0) -
      (b.period?.orderIndex ?? 0)
    );
  });

  return {
    workingDays,
    periods,
    lessons,
  };
};

const getFormMasterOptions = async (schoolClass, schoolId) => {
  const [classSubjects, teachers] = await Promise.all([
    ClassSubject.findAll({
      where: {
        schoolId,
        classId: schoolClass.id,
      },
      include: [
        {
          model: Subject,
          as: "subject",
          required: true,
          where: {
            schoolId,
            isActive: true,
          },
          attributes: ["id", "subjectName"],
        },
      ],
      order: [[{ model: Subject, as: "subject" }, "subjectName", "ASC"]],
    }),

    User.findAll({
      where: {
        schoolId,
        role: {
          [Op.in]: TEACHER_ROLES,
        },
        status: "ACTIVE",
      },
      attributes: ["id", "firstName", "surName", "role"],
      order: [
        ["firstName", "ASC"],
        ["surName", "ASC"],
      ],
    }),
  ]);

  return {
    subjects: classSubjects.map((item) => item.subject),
    teachers,
  };
};

/*
|--------------------------------------------------------------------------
| View Class Timetable
|--------------------------------------------------------------------------
*/

// GET /api/timetable?classId=<classId>

export const getTimetable = async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const { classId } = req.query;

    const schoolClass = await ensureClassBelongsToSchool(
      classId,
      schoolId
    );

    const access = await ensureCanViewClass(
      req,
      schoolClass,
      schoolId
    );

    const timetable = await getClassTimetableData(
      schoolClass,
      schoolId
    );

    let options = {
      subjects: [],
      teachers: [],
    };

    if (access.canConfigure) {
      options = await getFormMasterOptions(
        schoolClass,
        schoolId
      );
    }

    return res.status(200).json({
      success: true,
      message: "Timetable retrieved successfully.",
      data: {
        class: {
          id: schoolClass.id,
          classLevel: schoolClass.classLevel,
          arm: schoolClass.arm,
          formMasterId: schoolClass.formMasterId,
        },
        access: {
          role: access.accessRole,
          canConfigure: access.canConfigure,
        },
        workingDays: timetable.workingDays,
        periods: timetable.periods,
        lessons: timetable.lessons,
        subjects: options.subjects,
        teachers: options.teachers,
      },
    });
  } catch (error) {
    handleTimetableError(error, next, req);
  }
};

/*
|--------------------------------------------------------------------------
| School Working Days
|--------------------------------------------------------------------------
*/

// GET /api/timetable/working-days

export const getSchoolWorkingDays = async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);

    const days = await getWorkingDays(schoolId);

    return res.status(200).json({
      success: true,
      message: "Working days retrieved successfully.",
      data: {
        days,
        isConfigured: days.length > 0,
      },
    });
  } catch (error) {
    handleTimetableError(error, next, req);
  }
};

/*
|--------------------------------------------------------------------------
| Administrative Class Search
|--------------------------------------------------------------------------
*/

// GET /api/timetable/admin/classes

export const searchClassesForTimetable = async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);

   requireRole(req, ADMIN_VIEW_ROLES);

    const {
      search,
      classLevel,
      arm,
      page = DEFAULT_PAGE,
      limit = DEFAULT_LIMIT,
    } = req.query;

    const currentPage = Math.max(1, Number(page) || DEFAULT_PAGE);
    const pageSize = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(limit) || DEFAULT_LIMIT)
    );

    const where = { schoolId };

    if (classLevel) {
      where.classLevel = {
        [Op.like]: `%${classLevel}%`,
      };
    }

    if (arm) {
      where.arm = {
        [Op.like]: `%${arm}%`,
      };
    }

    if (search) {
      const searchValue = `%${search}%`;

      where[Op.or] = [
        { classLevel: { [Op.like]: searchValue } },
        { arm: { [Op.like]: searchValue } },
      ];
    }

    const { rows, count } = await Class.findAndCountAll({
      where,
      attributes: [
        "id",
        "classLevel",
        "arm",
        "educationSection",
        "formMasterId",
      ],
      include: [
        {
          model: User,
          as: "formMaster",
          required: false,
          attributes: [
            "id",
            "firstName",
            "surName",
            "status",
          ],
        },
        {
          model: TimetableLesson,
          as: "timetableLessons",
          required: false,
          attributes: ["id"],
        },
      ],
      distinct: true,
      limit: pageSize,
      offset: (currentPage - 1) * pageSize,
      order: [
        ["educationSection", "ASC"],
        ["classLevel", "ASC"],
        ["arm", "ASC"],
      ],
    });

    const classes = rows.map((item) => {
      const schoolClass = item.toJSON();
      const lessonCount = schoolClass.timetableLessons?.length ?? 0;

      return {
        id: schoolClass.id,
        classLevel: schoolClass.classLevel,
        arm: schoolClass.arm,
        educationSection: schoolClass.educationSection,

        formMaster: schoolClass.formMaster
          ? {
              id: schoolClass.formMaster.id,
              firstName: schoolClass.formMaster.firstName,
              surName: schoolClass.formMaster.surName,
              status: schoolClass.formMaster.status,
            }
          : null,

        hasFormMaster: Boolean(schoolClass.formMasterId),
        hasTimetable: lessonCount > 0,
        lessonCount,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Classes retrieved successfully.",
      data: {
        classes,
        pagination: {
          total: count,
          page: currentPage,
          limit: pageSize,
          totalPages: Math.ceil(count / pageSize),
          hasNextPage: currentPage * pageSize < count,
          hasPreviousPage: currentPage > 1,
        },
      },
    });
  } catch (error) {
    handleTimetableError(error, next, req);
  }
};

/*
|--------------------------------------------------------------------------
| Period Management
|--------------------------------------------------------------------------
*/

// POST /api/timetable/periods

export const createPeriod = async (req, res, next) => {
  const transaction = await dbConnection.transaction();

  try {
    const schoolId = getSchoolId(req);
    requireRole(PERIOD_MANAGEMENT_ROLES);

    const { name, time } = req.body;

    const existingPeriod = await TimetablePeriod.findOne({
      where: {
        schoolId,
        name,
      },
      transaction,
    });

    if (existingPeriod) {
      throw new AppError(
        "A timetable period with this name already exists.",
        409
      );
    }

    const highestOrder = await TimetablePeriod.max("orderIndex", {
      where: { schoolId },
      transaction,
    });

    const period = await TimetablePeriod.create(
      {
        schoolId,
        name,
        time: time ?? null,
        orderIndex:
          highestOrder === null || highestOrder === undefined
            ? 0
            : highestOrder + 1,
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Timetable period created successfully.",
      data: period,
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    handleTimetableError(error, next, req);
  }
};

// PATCH /api/timetable/periods/:periodId

export const updatePeriod = async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    requireRole(PERIOD_MANAGEMENT_ROLES);

    const { periodId } = req.params;
    const { name, time } = req.body;

    const period = await ensurePeriodBelongsToSchool(
      periodId,
      schoolId
    );

    if (name !== undefined && name !== period.name) {
      const duplicate = await TimetablePeriod.findOne({
        where: {
          schoolId,
          name,
          id: { [Op.ne]: period.id },
        },
      });

      if (duplicate) {
        throw new AppError(
          "A timetable period with this name already exists.",
          409
        );
      }
    }

    if (name !== undefined) period.name = name;
    if (time !== undefined) period.time = time || null;

    await period.save();

    return res.status(200).json({
      success: true,
      message: "Timetable period updated successfully.",
      data: period,
    });
  } catch (error) {
    handleTimetableError(error, next, req);
  }
};

// DELETE /api/timetable/periods/:periodId

export const deletePeriod = async (req, res, next) => {
  const transaction = await dbConnection.transaction();

  try {
    const schoolId = getSchoolId(req);
    requireRole(PERIOD_MANAGEMENT_ROLES);

    const { periodId } = req.params;

    const period = await ensurePeriodBelongsToSchool(
      periodId,
      schoolId,
      transaction
    );

    const lessonsUsingPeriod = await TimetableLesson.count({
      where: {
        schoolId,
        periodId,
      },
      transaction,
    });

    if (lessonsUsingPeriod > 0) {
      throw new AppError(
        `This period is currently used by ${lessonsUsingPeriod} timetable lesson(s). Remove or reassign those lessons before deleting the period.`,
        409
      );
    }

    await period.destroy({ transaction });

    await TimetablePeriod.update(
      {
        orderIndex: dbConnection.literal("orderIndex - 1"),
      },
      {
        where: {
          schoolId,
          orderIndex: {
            [Op.gt]: period.orderIndex,
          },
        },
        transaction,
      }
    );

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Timetable period deleted successfully.",
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    handleTimetableError(error, next, req);
  }
};

/*
|--------------------------------------------------------------------------
| Lesson Management
|--------------------------------------------------------------------------
*/

// POST /api/timetable/lessons

export const createLesson = async (req, res, next) => {
  const transaction = await dbConnection.transaction();

  try {
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

    await ensureFormMasterAccess(
      req.user,
      schoolClass,
      transaction
    );

    const workingDays = await getWorkingDays(
      schoolId,
      transaction
    );

    validateWorkingDay(dayOfWeek, workingDays);

    await ensurePeriodBelongsToSchool(
      periodId,
      schoolId,
      transaction
    );

    const subject = await ensureSubjectBelongsToClass({
      subjectId,
      classId,
      schoolId,
      transaction,
    });

    const teacher = await ensureTeacherBelongsToSchool(
      teacherId,
      schoolId,
      transaction
    );

    const duplicateSlot = await TimetableLesson.findOne({
      where: {
        schoolId,
        classId,
        periodId,
        dayOfWeek,
      },
      transaction,
    });

    if (duplicateSlot) {
      throw new AppError(
        "A lesson already exists for this class, day, and period.",
        409
      );
    }

    if (teacher) {
      const teacherConflict = await TimetableLesson.findOne({
        where: {
          schoolId,
          teacherId,
          periodId,
          dayOfWeek,
        },
        transaction,
      });

      if (teacherConflict) {
        throw new AppError(
          "This teacher is already assigned to another class during this period.",
          409
        );
      }
    }

    const lesson = await TimetableLesson.create(
      {
        schoolId,
        classId,
        periodId,
        dayOfWeek,
        subjectId: subject.id,
        teacherId: teacher?.id ?? null,
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
        {
          model: TimetablePeriod,
          as: "period",
          attributes: ["id", "name", "time", "orderIndex"],
        },
        {
          model: Subject,
          as: "subject",
          attributes: ["id", "subjectName"],
        },
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
      data: createdLesson,
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    handleTimetableError(error, next, req);
  }
};

// PATCH /api/timetable/lessons/:lessonId

export const updateLesson = async (req, res, next) => {
  const transaction = await dbConnection.transaction();

  try {
    const schoolId = getSchoolId(req);
    const { lessonId } = req.params;

    const lesson = await TimetableLesson.findOne({
      where: {
        id: lessonId,
        schoolId,
      },
      transaction,
    });

    if (!lesson) {
      throw new AppError("Timetable lesson not found.", 404);
    }

    const schoolClass = await ensureClassBelongsToSchool(
      lesson.classId,
      schoolId,
      transaction
    );

    await ensureFormMasterAccess(
      req.user,
      schoolClass,
      transaction
    );

    const nextPeriodId =
      req.body.periodId ?? lesson.periodId;

    const nextDay =
      req.body.dayOfWeek ?? lesson.dayOfWeek;

    const subjectChanged = Object.prototype.hasOwnProperty.call(
      req.body,
      "subjectId"
    );
    const nextSubjectId = subjectChanged
      ? req.body.subjectId
      : lesson.subjectId;

    const teacherChanged = Object.prototype.hasOwnProperty.call(
      req.body,
      "teacherId"
    );
    const nextTeacherId = teacherChanged
      ? req.body.teacherId
      : lesson.teacherId;

    const workingDays = await getWorkingDays(
      schoolId,
      transaction
    );

    validateWorkingDay(nextDay, workingDays);

    await ensurePeriodBelongsToSchool(
      nextPeriodId,
      schoolId,
      transaction
    );

    if (subjectChanged) {
      await ensureSubjectBelongsToClass({
        subjectId: nextSubjectId,
        classId: lesson.classId,
        schoolId,
        transaction,
      });
    }

    const teacher = teacherChanged
      ? await ensureTeacherBelongsToSchool(
          nextTeacherId,
          schoolId,
          transaction
        )
      : null;

    const duplicateSlot = await TimetableLesson.findOne({
      where: {
        schoolId,
        classId: lesson.classId,
        periodId: nextPeriodId,
        dayOfWeek: nextDay,
        id: { [Op.ne]: lesson.id },
      },
      transaction,
    });

    if (duplicateSlot) {
      throw new AppError(
        "Another lesson already occupies this class, day, and period.",
        409
      );
    }

    if (nextTeacherId) {
      const teacherConflict = await TimetableLesson.findOne({
        where: {
          schoolId,
          teacherId: nextTeacherId,
          periodId: nextPeriodId,
          dayOfWeek: nextDay,
          id: { [Op.ne]: lesson.id },
        },
        transaction,
      });

      if (teacherConflict) {
        throw new AppError(
          "This teacher is already assigned to another class during this period.",
          409
        );
      }
    }

    lesson.periodId = nextPeriodId;
    lesson.dayOfWeek = nextDay;
    lesson.subjectId = nextSubjectId;
    if (teacherChanged) {
      lesson.teacherId = teacher?.id ?? null;
    }

    await lesson.save({ transaction });

    await transaction.commit();

    const updatedLesson = await TimetableLesson.findOne({
      where: {
        id: lesson.id,
        schoolId,
      },
      include: [
        {
          model: TimetablePeriod,
          as: "period",
          attributes: ["id", "name", "time", "orderIndex"],
        },
        {
          model: Subject,
          as: "subject",
          attributes: ["id", "subjectName"],
        },
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
      data: updatedLesson,
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    handleTimetableError(error, next, req);
  }
};

// DELETE /api/timetable/lessons/:lessonId

export const deleteLesson = async (req, res, next) => {
  const transaction = await dbConnection.transaction();

  try {
    const schoolId = getSchoolId(req);
    const { lessonId } = req.params;

    const lesson = await TimetableLesson.findOne({
      where: {
        id: lessonId,
        schoolId,
      },
      transaction,
    });

    if (!lesson) {
      throw new AppError("Timetable lesson not found.", 404);
    }

    const schoolClass = await ensureClassBelongsToSchool(
      lesson.classId,
      schoolId,
      transaction
    );

    await ensureFormMasterAccess(
      req.user,
      schoolClass,
      transaction
    );

    await lesson.destroy({ transaction });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Timetable lesson deleted successfully.",
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    handleTimetableError(error, next, req);
  }
};

/*
|--------------------------------------------------------------------------
| Timetable PDF
|--------------------------------------------------------------------------
*/

// GET /api/timetable/pdf?classId=<classId>

export const generateTimetablePdf = async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req);
    const { classId } = req.query;

    const schoolClass = await ensureClassBelongsToSchool(
      classId,
      schoolId
    );

    await ensureCanViewClass(req, schoolClass, schoolId);

    const [school, timetable] = await Promise.all([
      School.findOne({
        where: { id: schoolId },
        attributes: ["id", "schoolName"],
      }),

      getClassTimetableData(schoolClass, schoolId),
    ]);

    const days = timetable.workingDays;
    const periods = timetable.periods;

    const lessonMap = new Map();

    for (const lesson of timetable.lessons) {
      lessonMap.set(
        `${lesson.dayOfWeek}:${lesson.periodId}`,
        lesson
      );
    }

    const className = [
      schoolClass.classLevel,
      schoolClass.arm,
    ]
      .filter(Boolean)
      .join(" ");

    const safeClassName = className.replace(/[^a-zA-Z0-9_-]/g, "_");

    const filename = `timetable_${safeClassName}.pdf`;

    const isDownload = req.query.download === "true";

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `${isDownload ? "attachment" : "inline"}; filename="${filename}"`
    );

    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margins: {
        top: 35,
        bottom: 35,
        left: 35,
        right: 35,
      },
      bufferPages: false,
    });

    doc.on("error", (error) => {
      console.error("Timetable PDF generation error:", error);
      if (!res.headersSent) {
        next(error);
      } else {
        res.destroy(error);
      }
    });

    doc.pipe(res);

    const pageWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;

    const dayColumnWidth =
      days.length > 0 ? pageWidth / (days.length + 1) : pageWidth;

    const periodColumnWidth = dayColumnWidth;

    const rowHeight = 52;
    const headerHeight = 34;

    const drawTableHeader = (y) => {
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor("#FFFFFF");

      doc
        .rect(
          doc.page.margins.left,
          y,
          periodColumnWidth,
          headerHeight
        )
        .fill("#123A8F");

      doc
        .fillColor("#FFFFFF")
        .text("PERIOD", doc.page.margins.left + 5, y + 11, {
          width: periodColumnWidth - 10,
          align: "center",
        });

      days.forEach((day, index) => {
        const x =
          doc.page.margins.left +
          periodColumnWidth +
          index * dayColumnWidth;

        doc
          .rect(x, y, dayColumnWidth, headerHeight)
          .fill("#123A8F");

        doc
          .fillColor("#FFFFFF")
          .text(day, x + 3, y + 11, {
            width: dayColumnWidth - 6,
            align: "center",
          });
      });
    };

    const drawLessonCell = (lesson, x, y, width, height) => {
      doc
        .lineWidth(0.5)
        .strokeColor("#CBD5E1")
        .rect(x, y, width, height)
        .stroke();

      if (!lesson) return;

      const subjectName =
        lesson.subject?.subjectName ?? "Subject";

      const teacherName = lesson.teacher
        ? `${lesson.teacher.firstName} ${lesson.teacher.surName}`
        : "";

      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor("#071A52")
        .text(subjectName, x + 4, y + 8, {
          width: width - 8,
          align: "center",
          ellipsis: true,
        });

      if (teacherName) {
        doc
          .font("Helvetica")
          .fontSize(7)
          .fillColor("#475569")
          .text(teacherName, x + 4, y + 24, {
            width: width - 8,
            align: "center",
            ellipsis: true,
          });
      }
    };

    doc
      .font("Helvetica-Bold")
      .fontSize(19)
      .fillColor("#071A52")
      .text(school?.schoolName || "School Timetable", {
        align: "center",
      });

    doc.moveDown(0.35);

    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor("#123A8F")
      .text(`${className} - TIMETABLE`, {
        align: "center",
      });

    doc.moveDown(0.8);

    let y = doc.y;

    if (days.length === 0) {
      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor("#475569")
        .text(
          "Working days have not been configured for this school.",
          { align: "center" }
        );
    } else if (periods.length === 0) {
      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor("#475569")
        .text(
          "No timetable periods have been configured for this school.",
          { align: "center" }
        );
    } else {
      drawTableHeader(y);
      y += headerHeight;

      for (const period of periods) {
        if (y + rowHeight > doc.page.height - 40) {
          doc.addPage();
          y = doc.page.margins.top;
          drawTableHeader(y);
          y += headerHeight;
        }

        doc
          .lineWidth(0.5)
          .strokeColor("#CBD5E1")
          .rect(
            doc.page.margins.left,
            y,
            periodColumnWidth,
            rowHeight
          )
          .stroke();

        doc
          .font("Helvetica-Bold")
          .fontSize(9)
          .fillColor("#071A52")
          .text(period.name, doc.page.margins.left + 5, y + 9, {
            width: periodColumnWidth - 10,
            align: "center",
          });

        if (period.time) {
          doc
            .font("Helvetica")
            .fontSize(7)
            .fillColor("#475569")
            .text(period.time, doc.page.margins.left + 5, y + 26, {
              width: periodColumnWidth - 10,
              align: "center",
            });
        }

        days.forEach((day, index) => {
          const x =
            doc.page.margins.left +
            periodColumnWidth +
            index * dayColumnWidth;

          const lesson = lessonMap.get(`${day}:${period.id}`);

          drawLessonCell(
            lesson,
            x,
            y,
            dayColumnWidth,
            rowHeight
          );
        });

        y += rowHeight;
      }
    }

    doc.end();
  } catch (error) {
    handleTimetableError(error, next, req);
  }
};