import {
  Class,
  Student,
  User,
  Session,
  Term,
  WorkingDay,
  AttendanceRegister,
  AttendanceRecord,
} from "../relationships/associations.js";

import AppError from "../utils/AppError.js";
import {dbConnection} from "../config/db.js";

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
    const timeZone = "Africa/Lagos";
    const now = new Date();

    const dateParts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);

    const dateValues = Object.fromEntries(
      dateParts.map(({ type, value }) => [type, value])
    );

    const attendanceDate =
      `${dateValues.year}-${dateValues.month}-${dateValues.day}`;

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
        "loginId",
      ],
    });

    if (!formMaster) {
      throw new AppError(
        "Your staff account could not be verified. Please contact your administrator.",
        403
      );
    }

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

    // 4. Look for today's register.
    // This function never creates one.
    const register = await AttendanceRegister.findOne({
      where: {
        schoolId,
        classId: assignedClass.id,
        attendanceDate,
      },
    });

    // 5. If no register exists, return the form master's
    // identity and assigned class so the frontend can show
    // the Take Attendance button.
    if (!register) {
      return res.status(200).json({
        success: true,
        message: "Today's attendance has not been started.",
        data: {
          attendanceDate,
          formMaster: {
            id: formMaster.id,
            firstName: formMaster.firstName,
            surName: formMaster.surName,
            loginId: formMaster.loginId,
          },
          class: assignedClass,
          attendanceRegister: null,
          students: [],
        },
      });
    }

    // 6. Get the current active class roster.
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
            "profileImageUrl",
          ],
        },
      ],
      order: [["createdAt", "ASC"]],
    });

    // 7. Load saved attendance records for this register.
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

    // 8. Return the complete roster with saved attendance statuses.
    const students = classStudents.map((student) => ({
      studentId: student.id,
      admissionNumber: student.admissionNumber,
      firstName: student.user?.firstName ?? null,
      surName: student.user?.surName ?? null,
      gender: student.gender,
      profileImageUrl: student.user?.profileImageUrl ?? null,
      status: statusByStudentId.has(student.id)
        ? statusByStudentId.get(student.id)
        : null,
    }));

    return res.status(200).json({
      success: true,
      message: "Today's attendance retrieved successfully.",
      data: {
        attendanceDate,
        formMaster: {
          id: formMaster.id,
          firstName: formMaster.firstName,
          surName: formMaster.surName,
          loginId: formMaster.loginId,
        },
        class: assignedClass,
        attendanceRegister: register,
        students,
      },
    });
  } catch (error) {
    return next(error);
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
    const timeZone = "Africa/Lagos";
    const now = new Date();

    const dateParts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);

    const dateValues = Object.fromEntries(
      dateParts.map(({ type, value }) => [type, value])
    );

    const attendanceDate =
      `${dateValues.year}-${dateValues.month}-${dateValues.day}`;

    const today = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "long",
    })
      .format(now)
      .toUpperCase();

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

    // 5. Find the active academic session.
    const activeSession = await Session.findOne({
      where: {
        schoolId,
        status: "ACTIVE",
        isCurrent: true,
      },
      transaction,
    });

    if (!activeSession) {
      throw new AppError(
        "There is no active academic session for your school.",
        409
      );
    }

    // 6. Find the active term in that session.
    const activeTerm = await Term.findOne({
      where: {
        sessionId: activeSession.id,
        status: "ACTIVE",
        isCurrent: true,
      },
      transaction,
    });

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
            "profileImageUrl",
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

    const students = classStudents.map((student) => ({
      studentId: student.id,
      admissionNumber: student.admissionNumber,
      firstName: student.user?.firstName ?? null,
      surName: student.user?.surName ?? null,
      gender: student.gender,
      profileImageUrl: student.user?.profileImageUrl ?? null,
      status: null,
    }));

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

    return next(error);
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
    const dateParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());

    const dateValues = Object.fromEntries(
      dateParts.map(({ type, value }) => [type, value])
    );

    const today =
      `${dateValues.year}-${dateValues.month}-${dateValues.day}`;

    if (register.attendanceDate !== today) {
      throw new AppError(
        "You can only save drafts for today's attendance.",
        400
      );
    }

    // 7. Confirm the school's current academic session.
    const currentSession = await Session.findOne({
      where: {
        schoolId,
        status: "ACTIVE",
        isCurrent: true,
      },
      transaction,
    });

    if (!currentSession) {
      throw new AppError(
        "The school does not have a current academic session configured.",
        409
      );
    }

    // 8. Confirm the current term belongs to the current session.
    const currentTerm = await Term.findOne({
      where: {
        sessionId: currentSession.id,
        status: "ACTIVE",
        isCurrent: true,
      },
      transaction,
    });

    if (!currentTerm) {
      throw new AppError(
        "The school does not have a current term configured for its current session.",
        409
      );
    }

    // 9. Prevent saving a register outside the current session or term.
    if (
      register.sessionId !== currentSession.id ||
      register.termId !== currentTerm.id
    ) {
      throw new AppError(
        "This attendance register is not part of the school's current session and term.",
        409
      );
    }

    // 10. Get the active students currently assigned to this class.
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

    // 11. Reject students outside the assigned class.
    const invalidStudent = students.find(
      (student) => !validStudentIds.has(student.studentId)
    );

    if (invalidStudent) {
      throw new AppError(
        "One or more students do not belong to your assigned class.",
        400
      );
    }

    // 12. Require the complete class roster.
    if (
      students.length !== classStudents.length ||
      classStudents.some((student) => !studentIds.includes(student.id))
    ) {
      throw new AppError(
        "Please submit the complete student list for this class.",
        400
      );
    }

    // 13. Create missing records or update existing records.
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

    return next(error);
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

    // 5. Find the school's current active session.
    const currentSession = await Session.findOne({
      where: {
        schoolId,
        isCurrent: true,
        status: "ACTIVE",
      },
      transaction,
    });

    if (!currentSession) {
      throw new AppError(
        "The school does not have a current active academic session.",
        409
      );
    }

    // 6. Find the current active term within that session.
    const currentTerm = await Term.findOne({
      where: {
        sessionId: currentSession.id,
        isCurrent: true,
        status: "ACTIVE",
      },
      transaction,
    });

    if (!currentTerm) {
      throw new AppError(
        "The school does not have a current active term.",
        409
      );
    }

    // 7. Ensure the register belongs to the current session and term.
    if (
      register.sessionId !== currentSession.id ||
      register.termId !== currentTerm.id
    ) {
      throw new AppError(
        "This attendance register is outside the school's current session or term.",
        409
      );
    }

    // 8. Retrieve the current active class roster.
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

    const currentStudentIds = new Set(
      classStudents.map((student) => student.id)
    );

    // 9. Ensure the request contains exactly the current roster.
    if (
      students.length !== classStudents.length ||
      students.some(
        (student) => !currentStudentIds.has(student.studentId)
      )
    ) {
      throw new AppError(
        "The submitted attendance list does not match the current class roster. Refresh and try again.",
        409
      );
    }

    // 10. Save the latest statuses.
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

    // 11. Read back and verify the saved records.
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

    const incomplete = classStudents.some((student) => {
      const status = recordsByStudentId.get(student.id);

      return status !== "PRESENT" && status !== "ABSENT";
    });

    const hasUnexpectedRecord = attendanceRecords.some(
      (record) => !currentStudentIds.has(record.studentId)
    );

    if (
      incomplete ||
      hasUnexpectedRecord ||
      attendanceRecords.length !== classStudents.length
    ) {
      throw new AppError(
        "Attendance could not be saved because the records do not match the complete class roster.",
        409
      );
    }

    // 12. Mark the register as submitted.
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
        totalStudents: classStudents.length,
        presentCount,
        absentCount,
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    return next(error);
  }
};
