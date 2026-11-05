import { handleControllerError } from "../utils/controllerError.js";
import { fn, col, Op } from "sequelize";
import { Class, Student, User, Session, Term, WorkingDay, AttendanceRegister, AttendanceRecord } from "../relationships/associations.js";
import AppError from "../utils/AppError.js";
import {dbConnection} from "../config/db.js";
import { getPrivateFileUrl } from "../services/storage/r2.service.js";
import { serializeStaffProfile } from "../utils/pendingProfile.js";

// School days are counted in the school's own timezone, never the server's,
// so a register created at 00:30 in Lagos is not filed under the previous day.
const ACADEMIC_TIME_ZONE = "Africa/Lagos";

const lagosDateKey = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: ACADEMIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

const lagosWeekday = (date = new Date()) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: ACADEMIC_TIME_ZONE,
    weekday: "long",
  })
    .format(date)
    .toUpperCase();

// The session and term the school is running right now. Attendance can only be
// changed while its register still belongs to this pair.
const findCurrentAcademicPeriod = async (schoolId, options = {}) => {
  const currentSession = await Session.findOne({
    where: {
      schoolId,
      status: "ACTIVE",
      isCurrent: true,
    },
    ...options,
  });

  if (!currentSession) {
    return { currentSession: null, currentTerm: null };
  }

  const currentTerm = await Term.findOne({
    where: {
      sessionId: currentSession.id,
      status: "ACTIVE",
      isCurrent: true,
    },
    ...options,
  });

  return { currentSession, currentTerm };
};

// The period pair a form master may still edit, and the label the page shows
// instead of a hardcoded session or term name.
const serializeAcademicPeriod = ({ currentSession, currentTerm }) => ({
  session: currentSession
    ? {
        id: currentSession.id,
        sessionName: currentSession.sessionName,
        startDate: currentSession.startDate,
        endDate: currentSession.endDate,
      }
    : null,
  term: currentTerm
    ? {
        id: currentTerm.id,
        termName: currentTerm.termName,
        startDate: currentTerm.startDate,
        endDate: currentTerm.endDate,
      }
    : null,
});

// Get today's attendance page for the authenticated form master.

export const getTodayAttendance = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;
    const userId = req.user?.id;

    if (!schoolId || !userId) {
      throw new AppError(
        "Authenticated school or user not found.",
        401
      );
    }

    // 1. Calculate today's date using Nigeria's local timezone.
    const attendanceDate = lagosDateKey();

    // 2. Retrieve the authenticated form master's identity.
    const formMaster = await User.findOne({
      where: {
        id: userId,
        schoolId,
        role: "STAFF",
        status: "ACTIVE",
      },
      attributes: [
        "id",
        "firstName",
        "surName",
        "email",
        "loginId",
      ],
    });

    if (!formMaster) {
      throw new AppError(
        "Your staff account could not be verified. Please contact your administrator.",
        403
      );
    }

    const formMasterProfile = serializeStaffProfile({
      id: formMaster.id,
      firstName: formMaster.firstName,
      surName: formMaster.surName,
      email: formMaster.email,
      loginId: formMaster.loginId,
    });

    // 3. Find the form master's assigned class.
    const assignedClasses = await Class.findAll({
      where: {
        schoolId,
        formMasterId: userId,
      },
    });

    if (assignedClasses.length === 0) {
      throw new AppError(
        "You are not assigned as a form master to any class. Please contact your administrator to assign you to a class.",
        403
      );
    }

    if (assignedClasses.length > 1) {
      throw new AppError(
        "You are assigned to multiple classes. Please contact your administrator.",
        409
      );
    }

    const assignedClass = assignedClasses[0];

    // 4. Look up the period the school is currently running. Attendance may
    // only be changed while a register still belongs to this session and term.
    const academicPeriod = serializeAcademicPeriod(
      await findCurrentAcademicPeriod(schoolId)
    );

    // 5. Look for today's register.
    // This function never creates one.
    const register = await AttendanceRegister.findOne({
      where: {
        schoolId,
        classId: assignedClass.id,
        attendanceDate,
      },
    });

    // 6. If no register exists, return the form master's
    // identity and assigned class so the frontend can show
    // the Take Attendance button.
    if (!register) {
      return res.status(200).json({
        success: true,
        message: "Today's attendance has not been started.",
        data: {
          attendanceDate,
          academicPeriod,
          formMaster: formMasterProfile,
          class: assignedClass,
          attendanceRegister: null,
          permissions: { canEdit: false },
          students: [],
        },
      });
    }

    // 7. Get the current active class roster.
    const classStudents = await Student.findAll({
      where: {
        schoolId,
        currentClassId: assignedClass.id,
        admissionStatus: "ACTIVE",
      },
      attributes: [
        "id",
        "admissionNumber",
        "gender",
      ],
      include: [
        {
          model: User,
          as: "user",
          attributes: [
            "firstName",
            "surName",
            "profileImageKey",
          ],
        },
      ],
      order: [["createdAt", "ASC"]],
    });

    // 8. Load saved attendance records for this register.
    const savedRecords = await AttendanceRecord.findAll({
      where: {
        attendanceRegisterId: register.id,
      },
      attributes: ["studentId", "status"],
    });

    const statusByStudentId = new Map(
      savedRecords.map((record) => [
        record.studentId,
        record.status,
      ])
    );

    // 9. Return the complete roster with saved attendance statuses.
    const students = await Promise.all(
      classStudents.map(async (student) => ({
        studentId: student.id,
        admissionNumber: student.admissionNumber,
        firstName: student.user?.firstName ?? null,
        surName: student.user?.surName ?? null,
        gender: student.gender,
        profileImageUrl: student.user?.profileImageKey
          ? await getPrivateFileUrl(student.user.profileImageKey)
          : null,
        status: statusByStudentId.has(student.id)
          ? statusByStudentId.get(student.id)
          : null,
      }))
    );

    return res.status(200).json({
      success: true,
      message: "Today's attendance retrieved successfully.",
      data: {
        attendanceDate,
        academicPeriod,
        formMaster: formMasterProfile,
        class: assignedClass,
        attendanceRegister: register,
        permissions: {
          canEdit:
            register.sessionId === academicPeriod.session?.id &&
            register.termId === academicPeriod.term?.id,
        },
        students,
      },
    });
  } catch (error) {
    return handleControllerError(error, next, req, "ATTENDANCE_CONTROLLER_ERROR", "Unable to process this request. Please try again.");
  }
};


export const createTodayAttendance = async (req, res, next) => {
  let transaction;

  try {
    transaction = await dbConnection.transaction();

    const schoolId = req.user?.schoolId;
    const userId = req.user?.id;

    if (!schoolId || !userId) {
      throw new AppError("Authenticated school or user not found.", 401);
    }

    // 1. Calculate today's date and weekday in Nigeria.
    const attendanceDate = lagosDateKey();
    const today = lagosWeekday();

    // 2. Find the form master's assigned class.
    const assignedClasses = await Class.findAll({
      where: {
        schoolId,
        formMasterId: userId,
      },
      transaction,
    });

    if (assignedClasses.length === 0) {
      throw new AppError(
        "You are not assigned as a form master to any class.",
        403
      );
    }

    if (assignedClasses.length > 1) {
      throw new AppError(
        "You are assigned to multiple classes. Please contact your administrator.",
        409
      );
    }

    const assignedClass = assignedClasses[0];

    // 3. Check again in case another request already created
    // today's register after the frontend fetched the page.
    const existingRegister = await AttendanceRegister.findOne({
      where: {
        schoolId,
        classId: assignedClass.id,
        attendanceDate,
      },
      transaction,
    });

    if (existingRegister) {
      await transaction.commit();

      return res.status(200).json({
        success: true,
        message: "Today's attendance register already exists.",
        data: {
          attendanceDate,
          attendanceRegister: existingRegister,
        },
      });
    }

    // 4. Check the school's configured working days.
    const workingDay = await WorkingDay.findOne({
      where: { schoolId },
      transaction,
    });

    if (!workingDay) {
      throw new AppError(
        "Working days have not been configured for your school. Please contact your administrator.",
        409
      );
    }

    if (
      !Array.isArray(workingDay.days) ||
      !workingDay.days.includes(today)
    ) {
      throw new AppError(
        "Attendance cannot be started because today is not a working day.",
        400
      );
    }

    // 5. Find the academic session and term the school is running.
    const {
      currentSession: activeSession,
      currentTerm: activeTerm,
    } = await findCurrentAcademicPeriod(schoolId, { transaction });

    if (!activeSession) {
      throw new AppError(
        "There is no active academic session for your school.",
        409
      );
    }

    // 6. Confirm that term exists too.
    if (!activeTerm) {
      throw new AppError(
        "There is no active academic term for your school.",
        409
      );
    }

    // 7. Retrieve the active students in the assigned class.
    const classStudents = await Student.findAll({
      where: {
        schoolId,
        currentClassId: assignedClass.id,
        admissionStatus: "ACTIVE",
      },
      attributes: [
        "id",
        "admissionNumber",
        "gender",
      ],
      include: [
        {
          model: User,
          as: "user",
          attributes: [
            "firstName",
            "surName",
            "profileImageKey",
          ],
        },
      ],
      order: [["createdAt", "ASC"]],
      transaction,
    });

    if (classStudents.length === 0) {
      throw new AppError(
        "There are no active students in your assigned class.",
        409
      );
    }

    // 8. Create the draft register only when this endpoint is called.
    const attendanceRegister = await AttendanceRegister.create(
      {
        schoolId,
        classId: assignedClass.id,
        attendanceDate,
        sessionId: activeSession.id,
        termId: activeTerm.id,
        createdByUserId: userId,
        status: "DRAFT",
      },
      { transaction }
    );

    // No AttendanceRecord rows are created until the draft is saved.

    const students = await Promise.all(
      classStudents.map(async (student) => ({
        studentId: student.id,
        admissionNumber: student.admissionNumber,
        firstName: student.user?.firstName ?? null,
        surName: student.user?.surName ?? null,
        gender: student.gender,
        profileImageUrl: student.user?.profileImageKey
          ? await getPrivateFileUrl(student.user.profileImageKey)
          : null,
        status: null,
      }))
    );

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Today's attendance register created successfully.",
      data: {
        attendanceDate,
        class: assignedClass,
        session: activeSession,
        term: activeTerm,
        attendanceRegister,
        students,
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    if (error.name === "SequelizeUniqueConstraintError") {
      return next(
        new AppError(
          "Today's attendance register already exists. Refresh the page to retrieve it.",
          409
        )
      );
    }

    return handleControllerError(error, next, req, "ATTENDANCE_CONTROLLER_ERROR", "Unable to process this request. Please try again.");
  }
};




export const saveAttendanceDraft = async (req, res, next) => {
  let transaction;

  try {
    transaction = await dbConnection.transaction();

    const schoolId = req.user?.schoolId;
    const userId = req.user?.id;
    const { registerId } = req.params;
    const { students } = req.body;

    if (!schoolId || !userId) {
      throw new AppError("Authenticated school or user not found.", 401);
    }

    if (!registerId) {
      throw new AppError("Attendance register ID is required.", 400);
    }

    if (!Array.isArray(students) || students.length === 0) {
      throw new AppError(
        "Please provide the student attendance list.",
        400
      );
    }

    // 1. Prevent duplicate or missing student IDs.
    const studentIds = students.map((student) => student.studentId);

    if (
      studentIds.some((id) => !id) ||
      new Set(studentIds).size !== studentIds.length
    ) {
      throw new AppError(
        "Every student must have a valid, unique student ID.",
        400
      );
    }

    // 2. Validate attendance statuses.
    const allowedStatuses = ["PRESENT", "ABSENT", null];

    for (const student of students) {
      if (!allowedStatuses.includes(student.status)) {
        throw new AppError(
          "Attendance status must be PRESENT, ABSENT, or null.",
          400
        );
      }
    }

    // 3. Find the register belonging to this school.
    const register = await AttendanceRegister.findOne({
      where: {
        id: registerId,
        schoolId,
      },
      transaction,
    });

    if (!register) {
      throw new AppError("Attendance register not found.", 404);
    }

    // 4. Only the assigned form master can save this register.
    const assignedClass = await Class.findOne({
      where: {
        id: register.classId,
        schoolId,
        formMasterId: userId,
      },
      transaction,
    });

    if (!assignedClass) {
      throw new AppError(
        "You are not authorized to manage attendance for this class.",
        403
      );
    }

    // 5. Save Draft is only for registers that are not submitted.
    if (register.status !== "DRAFT") {
      throw new AppError(
        "This attendance has already been submitted. Use the appropriate update or submission action.",
        409
      );
    }

    // 6. Save Draft is only allowed for today's attendance.
    if (register.attendanceDate !== lagosDateKey()) {
      throw new AppError(
        "You can only save drafts for today's attendance.",
        400
      );
    }

    // 7. Confirm the school is running a session with an active term.
    const { currentSession, currentTerm } =
      await findCurrentAcademicPeriod(schoolId, { transaction });

    if (!currentSession) {
      throw new AppError(
        "The school does not have a current academic session configured.",
        409
      );
    }

    if (!currentTerm) {
      throw new AppError(
        "The school does not have a current term configured for its current session.",
        409
      );
    }

    // 8. Prevent saving a register outside the current session or term.
    if (
      register.sessionId !== currentSession.id ||
      register.termId !== currentTerm.id
    ) {
      throw new AppError(
        "This attendance register is not part of the school's current session and term.",
        409
      );
    }

    // 9. Get the active students currently assigned to this class.
    const classStudents = await Student.findAll({
      where: {
        schoolId,
        currentClassId: assignedClass.id,
        admissionStatus: "ACTIVE",
      },
      attributes: ["id"],
      transaction,
    });

    if (classStudents.length === 0) {
      throw new AppError(
        "There are no active students in this class.",
        409
      );
    }

    const validStudentIds = new Set(
      classStudents.map((student) => student.id)
    );

    // 10. Reject students outside the assigned class.
    const invalidStudent = students.find(
      (student) => !validStudentIds.has(student.studentId)
    );

    if (invalidStudent) {
      throw new AppError(
        "One or more students do not belong to your assigned class.",
        400
      );
    }

    // 11. Require the complete class roster.
    if (
      students.length !== classStudents.length ||
      classStudents.some((student) => !studentIds.includes(student.id))
    ) {
      throw new AppError(
        "Please submit the complete student list for this class.",
        400
      );
    }

    // 12. Create missing records or update existing records.
    for (const student of students) {
      const existingRecord = await AttendanceRecord.findOne({
        where: {
          attendanceRegisterId: register.id,
          studentId: student.studentId,
        },
        transaction,
      });

      if (existingRecord) {
        await existingRecord.update(
          { status: student.status },
          { transaction }
        );
      } else {
        await AttendanceRecord.create(
          {
            attendanceRegisterId: register.id,
            studentId: student.studentId,
            status: student.status,
          },
          { transaction }
        );
      }
    }

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Attendance draft saved successfully.",
      data: {
        attendanceRegister: {
          id: register.id,
          attendanceDate: register.attendanceDate,
          status: register.status,
        },
        totalStudents: students.length,
        markedStudents: students.filter(
          (student) => student.status !== null
        ).length,
        unmarkedStudents: students.filter(
          (student) => student.status === null
        ).length,
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    return handleControllerError(error, next, req, "ATTENDANCE_CONTROLLER_ERROR", "Unable to process this request. Please try again.");
  }
};





export const submitAttendance = async (req, res, next) => {
  let transaction;

  try {
    transaction = await dbConnection.transaction();

    const schoolId = req.user?.schoolId;
    const userId = req.user?.id;
    const { registerId } = req.params;
    const { students } = req.body;

    if (!schoolId || !userId) {
      throw new AppError(
        "Authenticated school or user not found.",
        401
      );
    }

    if (!registerId) {
      throw new AppError(
        "Attendance register ID is required.",
        400
      );
    }

    // 1. Validate the submitted student list.
    if (!Array.isArray(students) || students.length === 0) {
      throw new AppError(
        "Please provide the complete student attendance list.",
        400
      );
    }

    const studentIds = students.map(
      (student) => student.studentId
    );

    if (
      students.some((student) => !student.studentId) ||
      new Set(studentIds).size !== studentIds.length
    ) {
      throw new AppError(
        "Every student must have a valid, unique student ID.",
        400
      );
    }

    if (
      students.some(
        (student) =>
          student.status !== "PRESENT" &&
          student.status !== "ABSENT"
      )
    ) {
      throw new AppError(
        "Every student must be marked PRESENT or ABSENT before submission.",
        400
      );
    }

    // 2. Find and lock the register.
    const register = await AttendanceRegister.findOne({
      where: {
        id: registerId,
        schoolId,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!register) {
      throw new AppError(
        "Attendance register not found.",
        404
      );
    }

    // Remember the original status to return an accurate message.
    const wasAlreadySubmitted = register.status === "SUBMITTED";

    // 3. Allow only draft or submitted registers.
    if (!["DRAFT", "SUBMITTED"].includes(register.status)) {
      throw new AppError(
        "This attendance register cannot be updated.",
        409
      );
    }

    // 4. Confirm that the user is the assigned form master.
    const assignedClass = await Class.findOne({
      where: {
        id: register.classId,
        schoolId,
        formMasterId: userId,
      },
      transaction,
    });

    if (!assignedClass) {
      throw new AppError(
        "You are not authorized to manage attendance for this class.",
        403
      );
    }

    // 5. Find the session and term the school is running right now.
    const { currentSession, currentTerm } =
      await findCurrentAcademicPeriod(schoolId, { transaction });

    if (!currentSession) {
      throw new AppError(
        "The school does not have a current active academic session.",
        409
      );
    }

    if (!currentTerm) {
      throw new AppError(
        "The school does not have a current active term.",
        409
      );
    }

    // 6. Ensure the register belongs to the current session and term.
    if (
      register.sessionId !== currentSession.id ||
      register.termId !== currentTerm.id
    ) {
      throw new AppError(
        "This attendance register is outside the school's current session or term.",
        409
      );
    }

    // 7. Work out which students this register must cover.
    // Today's register follows the live class roster, but a correction to an
    // earlier day is judged against the students recorded on that day: a
    // pupil who has since left the class still attended, or missed, that day.
    const isCurrentDay =
      register.attendanceDate === lagosDateKey();

    const rosterStudentIds = isCurrentDay
      ? (
          await Student.findAll({
            where: {
              schoolId,
              currentClassId: assignedClass.id,
              admissionStatus: "ACTIVE",
            },
            attributes: ["id"],
            transaction,
          })
        ).map((student) => student.id)
      : (
          await AttendanceRecord.findAll({
            where: { attendanceRegisterId: register.id },
            attributes: ["studentId"],
            transaction,
            raw: true,
          })
        ).map((record) => record.studentId);

    if (rosterStudentIds.length === 0) {
      throw new AppError(
        isCurrentDay
          ? "There are no active students in this class."
          : "No students are recorded on this attendance register.",
        409
      );
    }

    const roster = new Set(rosterStudentIds);

    // 8. Ensure the request contains exactly that roster.
    if (
      students.length !== roster.size ||
      students.some((student) => !roster.has(student.studentId))
    ) {
      throw new AppError(
        isCurrentDay
          ? "The submitted attendance list does not match the current class roster. Refresh and try again."
          : "The submitted attendance list does not match the students recorded on this register. Refresh and try again.",
        409
      );
    }

    // 9. Save the latest statuses.
    // Update existing records and create missing ones.
    for (const student of students) {
      const [record, created] = await AttendanceRecord.findOrCreate({
        where: {
          attendanceRegisterId: register.id,
          studentId: student.studentId,
        },
        defaults: {
          attendanceRegisterId: register.id,
          studentId: student.studentId,
          status: student.status,
        },
        transaction,
      });

      if (!created) {
        await record.update(
          { status: student.status },
          { transaction }
        );
      }
    }

    // 10. Read back and verify the saved records.
    const attendanceRecords = await AttendanceRecord.findAll({
      where: {
        attendanceRegisterId: register.id,
      },
      attributes: ["studentId", "status"],
      transaction,
    });

    const recordsByStudentId = new Map(
      attendanceRecords.map((record) => [
        record.studentId,
        record.status,
      ])
    );

    const incomplete = rosterStudentIds.some((studentId) => {
      const status = recordsByStudentId.get(studentId);

      return status !== "PRESENT" && status !== "ABSENT";
    });

    const hasUnexpectedRecord = attendanceRecords.some(
      (record) => !roster.has(record.studentId)
    );

    if (
      incomplete ||
      hasUnexpectedRecord ||
      attendanceRecords.length !== rosterStudentIds.length
    ) {
      throw new AppError(
        "Attendance could not be saved because the records do not match the complete class roster.",
        409
      );
    }

    // 11. Mark the register as submitted.
    // A submitted register remains submitted when corrected.
    await register.update(
      { status: "SUBMITTED" },
      { transaction }
    );

    const presentCount = attendanceRecords.filter(
      (record) => record.status === "PRESENT"
    ).length;

    const absentCount = attendanceRecords.filter(
      (record) => record.status === "ABSENT"
    ).length;

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: wasAlreadySubmitted
        ? "Attendance corrections saved successfully."
        : "Attendance submitted successfully.",
      data: {
        attendanceRegister: {
          id: register.id,
          attendanceDate: register.attendanceDate,
          status: "SUBMITTED",
        },
        totalStudents: rosterStudentIds.length,
        presentCount,
        absentCount,
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    return handleControllerError(error, next, req, "ATTENDANCE_CONTROLLER_ERROR", "Unable to process this request. Please try again.");
  }
};


// ============================================
// ATTENDANCE HISTORY — ADMINISTRATOR ACCESS
// ============================================

const assertAttendanceHistoryAccess = (req) => {
  const allowedRoles = [
    "LEADER",
    "VICE_LEADER",
    "ADMINISTRATOR",
  ];

  if (!req.user?.schoolId) {
    throw new AppError("Authenticated school not found.", 401);
  }

  if (!allowedRoles.includes(req.user?.role)) {
    throw new AppError(
      "You are not authorized to access attendance history.",
      403
    );
  }
};

// Present, absent and unconfirmed counts per register, read from the records
// themselves so a historical register keeps the numbers of its own day rather
// than those of the class roster today.
const getAttendanceSummaries = async (registerIds) => {
  const summaries = new Map(
    registerIds.map((registerId) => [
      registerId,
      {
        totalStudents: 0,
        presentCount: 0,
        absentCount: 0,
        unconfirmedCount: 0,
      },
    ])
  );

  if (!registerIds.length) return summaries;

  const records = await AttendanceRecord.findAll({
    where: {
      attendanceRegisterId: {
        [Op.in]: registerIds,
      },
    },
    attributes: ["attendanceRegisterId", "status"],
    raw: true,
  });

  for (const record of records) {
    const counts = summaries.get(record.attendanceRegisterId);

    if (!counts) continue;

    counts.totalStudents += 1;

    if (record.status === "PRESENT") {
      counts.presentCount += 1;
    } else if (record.status === "ABSENT") {
      counts.absentCount += 1;
    } else {
      counts.unconfirmedCount += 1;
    }
  }

  return summaries;
};

// A register may only be changed while it still belongs to the session and
// term the school is running.
const isRegisterInCurrentPeriod = (register, currentPeriod) =>
  Boolean(
    currentPeriod.currentSession &&
      currentPeriod.currentTerm &&
      register.sessionId === currentPeriod.currentSession.id &&
      register.termId === currentPeriod.currentTerm.id
  );

// Date-range filter shared by the administrator and form-master history lists.
const buildAttendanceDateFilter = ({ fromDate, toDate }) => {
  if (fromDate && toDate) {
    return { [Op.between]: [fromDate, toDate] };
  }

  if (fromDate) return { [Op.gte]: fromDate };

  if (toDate) return { [Op.lte]: toDate };

  return undefined;
};

// Only the sessions and terms that actually have registers are offered as
// filters, so a history page never lists a period that shows nothing.
const getAttendancePeriodFacets = async (registerWhere) => {
  const periodPairs = await AttendanceRegister.findAll({
    where: registerWhere,
    attributes: ["sessionId", "termId"],
    group: ["sessionId", "termId"],
    raw: true,
  });

  const sessionIds = [
    ...new Set(periodPairs.map((pair) => pair.sessionId)),
  ];
  const termIds = [...new Set(periodPairs.map((pair) => pair.termId))];

  const [sessions, terms] = await Promise.all([
    Session.findAll({
      where: { id: { [Op.in]: sessionIds } },
      attributes: ["id", "sessionName", "startDate"],
      order: [["startDate", "DESC"]],
    }),
    Term.findAll({
      where: { id: { [Op.in]: termIds } },
      attributes: ["id", "termName", "sessionId", "startDate"],
      order: [["startDate", "DESC"]],
    }),
  ]);

  return { sessions, terms };
};

// School-wide totals for the current filters, counted from the records
// themselves so the summary cards cover every matching register instead of
// only the page on screen.
const getAggregateAttendanceSummary = async (registerWhere, totalRegisters) => {
  const statusRows = await AttendanceRecord.findAll({
    attributes: ["status", [fn("COUNT", col("AttendanceRecord.id")), "count"]],
    include: [
      {
        model: AttendanceRegister,
        as: "attendanceRegister",
        attributes: [],
        required: true,
        where: registerWhere,
      },
    ],
    group: ["AttendanceRecord.status"],
    raw: true,
  });

  let presentCount = 0;
  let absentCount = 0;
  let unmarkedCount = 0;

  for (const row of statusRows) {
    const count = Number(row.count) || 0;

    if (row.status === "PRESENT") presentCount += count;
    else if (row.status === "ABSENT") absentCount += count;
    else unmarkedCount += count;
  }

  const markedCount = presentCount + absentCount;

  return {
    totalRegisters,
    totalRecords: presentCount + absentCount + unmarkedCount,
    presentCount,
    absentCount,
    unmarkedCount,
    markedCount,
    attendanceRate: markedCount
      ? Math.round((presentCount / markedCount) * 1000) / 10
      : null,
  };
};


// ============================================
// 1. GET ATTENDANCE HISTORY
// ============================================

export const getAttendanceHistory = async (req, res, next) => {
  try {
    assertAttendanceHistoryAccess(req);

    const schoolId = req.user.schoolId;

    const {
      sessionId,
      termId,
      classId,
      fromDate,
      toDate,
      status,
    } = req.query;

    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 10, 1),
      100
    );

    const offset = (page - 1) * limit;

    // Always restrict the query to the authenticated school.
    const where = { schoolId };

    if (sessionId) where.sessionId = sessionId;
    if (termId) where.termId = termId;
    if (classId) where.classId = classId;
    if (status) where.status = status;

    // Optional attendance date range.
    const dateFilter = buildAttendanceDateFilter({ fromDate, toDate });

    if (dateFilter) {
      where.attendanceDate = dateFilter;
    }

    // Retrieve registers without joining the hasMany attendance records.
    // This prevents duplicate registers from affecting pagination.
    const { count, rows: registers } =
      await AttendanceRegister.findAndCountAll({
        where,
        attributes: [
          "id",
          "classId",
          "sessionId",
          "termId",
          "attendanceDate",
          "status",
          "createdByUserId",
          "createdAt",
          "updatedAt",
        ],
        include: [
          {
            model: Class,
            as: "class",
            attributes: ["id", "classLevel", "arm", "formMasterId"],
            required: true,
            where: { schoolId },
          },
          {
            model: Session,
            as: "session",
            attributes: ["id", "sessionName"],
            required: true,
          },
          {
            model: Term,
            as: "term",
            attributes: ["id", "termName"],
            required: true,
          },
          {
            model: User,
            as: "createdBy",
            attributes: [
              "id",
              "firstName",
              "surName",
              "email",
              "loginId",
            ],
            required: true,
            where: { schoolId },
          },
        ],
        order: [
          ["attendanceDate", "DESC"],
          ["createdAt", "DESC"],
        ],
        limit,
        offset,
        distinct: true,
      });

    const summaries = await getAttendanceSummaries(
      registers.map((register) => register.id)
    );

    // Totals span every register matching these filters, not just this page,
    // and the period options follow the class that is being looked at.
    const [summary, availablePeriods] = await Promise.all([
      getAggregateAttendanceSummary(where, count),
      getAttendancePeriodFacets({
        schoolId,
        ...(classId ? { classId } : {}),
        ...(sessionId ? { sessionId } : {}),
      }),
    ]);

    // Administrators read every class but never edit it: editing belongs to
    // the form master who owns the register.
    const data = registers.map((register) => ({
      ...register.toJSON(),
      createdBy: register.createdBy
        ? serializeStaffProfile(register.createdBy)
        : register.createdBy,
      attendanceSummary: summaries.get(register.id),
    }));

    return res.status(200).json({
      success: true,
      message: "Attendance history retrieved successfully.",
      data,
      summary,
      availablePeriods,
      pagination: {
        totalItems: count,
        currentPage: page,
        pageSize: limit,
        totalPages: Math.ceil(count / limit),
        hasNextPage: page * limit < count,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    return handleControllerError(
      error,
      next,
      req,
      "ATTENDANCE_CONTROLLER_ERROR",
      "Unable to retrieve attendance history. Please try again."
    );
  }
};


// ============================================
// 2. GET FORM MASTER'S OWN ATTENDANCE HISTORY
// ============================================

export const getMyAttendanceHistory = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;
    const userId = req.user?.id;

    if (!schoolId || !userId) {
      throw new AppError(
        "Authenticated school or user not found.",
        401
      );
    }

    // The class comes from the caller, never from the query string, so a form
    // master can only ever read their own register history.
    const assignedClasses = await Class.findAll({
      where: {
        schoolId,
        formMasterId: userId,
      },
    });

    if (assignedClasses.length === 0) {
      throw new AppError(
        "You are not assigned as a form master to any class.",
        403
      );
    }

    if (assignedClasses.length > 1) {
      throw new AppError(
        "You are assigned to multiple classes. Please contact your administrator.",
        409
      );
    }

    const assignedClass = assignedClasses[0];

    const { sessionId, termId, fromDate, toDate, status } =
      req.query;

    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 10, 1),
      100
    );

    const offset = (page - 1) * limit;

    const where = { schoolId, classId: assignedClass.id };

    if (sessionId) where.sessionId = sessionId;
    if (termId) where.termId = termId;
    if (status) where.status = status;

    const dateFilter = buildAttendanceDateFilter({
      fromDate,
      toDate,
    });

    if (dateFilter) {
      where.attendanceDate = dateFilter;
    }

    const { count, rows: registers } =
      await AttendanceRegister.findAndCountAll({
        where,
        attributes: [
          "id",
          "sessionId",
          "termId",
          "attendanceDate",
          "status",
          "createdAt",
          "updatedAt",
        ],
        include: [
          {
            model: Session,
            as: "session",
            attributes: ["id", "sessionName"],
            required: true,
          },
          {
            model: Term,
            as: "term",
            attributes: ["id", "termName"],
            required: true,
          },
        ],
        order: [
          ["attendanceDate", "DESC"],
          ["createdAt", "DESC"],
        ],
        limit,
        offset,
        distinct: true,
      });

    const summaries = await getAttendanceSummaries(
      registers.map((register) => register.id)
    );

    const currentPeriod =
      await findCurrentAcademicPeriod(schoolId);

    // Only the sessions and terms this class actually has registers for are
    // offered as filters, so the page never lists an empty period.
    const [summary, availablePeriods] = await Promise.all([
      getAggregateAttendanceSummary(where, count),
      getAttendancePeriodFacets({
        schoolId,
        classId: assignedClass.id,
        ...(sessionId ? { sessionId } : {}),
      }),
    ]);

    return res.status(200).json({
      success: true,
      message:
        "Your attendance history retrieved successfully.",
      data: {
        class: assignedClass,
        academicPeriod: serializeAcademicPeriod(currentPeriod),
        availablePeriods,
        summary,
        registers: registers.map((register) => ({
          ...register.toJSON(),
          attendanceSummary: summaries.get(register.id),
          canEdit: isRegisterInCurrentPeriod(register, currentPeriod),
        })),
      },
      pagination: {
        totalItems: count,
        currentPage: page,
        pageSize: limit,
        totalPages: Math.ceil(count / limit),
        hasNextPage: page * limit < count,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    return handleControllerError(
      error,
      next,
      req,
      "ATTENDANCE_CONTROLLER_ERROR",
      "Unable to retrieve your attendance history. Please try again."
    );
  }
};


// ============================================
// 3. GET ATTENDANCE HISTORY DETAILS
// ============================================

export const getAttendanceHistoryDetails = async (
  req,
  res,
  next
) => {
  try {
    if (!req.user?.schoolId) {
      throw new AppError("Authenticated school not found.", 401);
    }

    const schoolId = req.user.schoolId;
    const { registerId } = req.params;

    if (!registerId) {
      throw new AppError(
        "Attendance register ID is required.",
        400
      );
    }

    // Find the register within the authenticated school.
    const register = await AttendanceRegister.findOne({
      where: {
        id: registerId,
        schoolId,
      },
      attributes: [
        "id",
        "schoolId",
        "classId",
        "sessionId",
        "termId",
        "attendanceDate",
        "createdByUserId",
        "status",
        "createdAt",
        "updatedAt",
      ],
      include: [
        {
          model: Class,
          as: "class",
          attributes: ["id", "classLevel", "arm", "formMasterId"],
          required: true,
          where: { schoolId },
        },
        {
          model: Session,
          as: "session",
          attributes: ["id", "sessionName"],
          required: true,
        },
        {
          model: Term,
          as: "term",
          attributes: ["id", "termName"],
          required: true,
        },
        {
          model: User,
          as: "createdBy",
          attributes: [
            "id",
            "firstName",
            "surName",
            "email",
            "loginId",
          ],
          required: true,
          where: { schoolId },
        },
      ],
    });

    if (!register) {
      throw new AppError(
        "Attendance register not found.",
        404
      );
    }

    // The class's own form master may read the register so they can review and
    // correct it; anyone else needs administrator history access.
    const isFormMaster =
      register.class?.formMasterId === req.user.id;

    if (!isFormMaster) {
      assertAttendanceHistoryAccess(req);
    }

    // Retrieve the students recorded against this historical register.
    // Do not use the class's current student roster here.
    const attendanceRecords = await AttendanceRecord.findAll({
      where: {
        attendanceRegisterId: register.id,
      },
      attributes: [
        "id",
        "studentId",
        "status",
        "createdAt",
        "updatedAt",
      ],
      include: [
        {
          model: Student,
          as: "student",
          attributes: [
            "id",
            "admissionNumber",
            "gender",
          ],
          required: true,
          where: { schoolId },
          include: [
            {
              model: User,
              as: "user",
              attributes: [
                "firstName",
                "surName",
              ],
              required: true,
              where: { schoolId },
            },
          ],
        },
      ],
      order: [
        [
          { model: Student, as: "student" },
          "admissionNumber",
          "ASC",
        ],
      ],
    });

    const students = attendanceRecords.map((record) => {
      const student = record.student;

      return {
        attendanceRecordId: record.id,
        studentId: student.id,
        admissionNumber: student.admissionNumber,
        firstName: student.user?.firstName ?? null,
        surName: student.user?.surName ?? null,
        gender: student.gender,
        status: record.status,
      };
    });

    const presentCount = students.filter(
      (student) => student.status === "PRESENT"
    ).length;

    const absentCount = students.filter(
      (student) => student.status === "ABSENT"
    ).length;

    const unconfirmedCount = students.filter(
      (student) => student.status === null
    ).length;

    const currentPeriod =
      await findCurrentAcademicPeriod(schoolId);

    const canEdit =
      isFormMaster && isRegisterInCurrentPeriod(register, currentPeriod);

    const registerPayload = register.toJSON();

    return res.status(200).json({
      success: true,
      message: "Attendance register details retrieved successfully.",
      data: {
        attendanceRegister: {
          ...registerPayload,
          createdBy: registerPayload.createdBy
            ? serializeStaffProfile(registerPayload.createdBy)
            : registerPayload.createdBy,
        },
        academicPeriod: serializeAcademicPeriod(currentPeriod),
        permissions: {
          canEdit,
          reason: canEdit
            ? null
            : isFormMaster
            ? "This register belongs to a session or term that is no longer current, so it can no longer be changed."
            : "Only the form master of this class can change its attendance.",
        },
        attendanceSummary: {
          totalStudents: students.length,
          presentCount,
          absentCount,
          unconfirmedCount,
        },
        students,
      },
    });
  } catch (error) {
    return handleControllerError(
      error,
      next,
      req,
      "ATTENDANCE_CONTROLLER_ERROR",
      "Unable to retrieve attendance register details. Please try again."
    );
  }
};
