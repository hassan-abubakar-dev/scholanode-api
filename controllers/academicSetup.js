import { dbConnection } from "../config/db.js";
import Session from "../models/Session.js";
import  Term  from "../models/Term.js";
import Class from "../models/Class.js";
import Subject from "../models/Subject.js";
import School from "../models/School.js";
import AppError from "../utils/AppError.js";
import WorkingDay from "../models/WorkingDay.js";
import { Op } from "sequelize";




export const createSessionWithTerms = async (req, res, next) => {
  const transaction = await dbConnection.transaction();

  try {
    // 1. Get authenticated school
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      await transaction.rollback();
      return next(
        new AppError("Authenticated school not found.", 401)
      );
    }

    // 2. Get request data
    const { session, terms } = req.body;

    const sessionStartDate = new Date(session.startDate);
    const sessionEndDate = new Date(session.endDate);

    // Validate that each term date range falls within the session dates
    for (const term of terms) {
      const termStartDate = new Date(term.startDate);
      const termEndDate = new Date(term.endDate);

      if (
        termStartDate < sessionStartDate ||
        termEndDate > sessionEndDate
      ) {
        await transaction.rollback();
        return next(
          new AppError(
            `${term.termName} dates must fall within the session dates.`,
            400
          )
        );
      }
    }

    // 7. Check for duplicate session
    const existingSession = await Session.findOne({
      where: {
        schoolId,
        sessionName: session.sessionName.trim(),
      },
      transaction,
    });

    if (existingSession) {
      await transaction.rollback();
      return next(
        new AppError(
          "A session with this name already exists for this school.",
          409
        )
      );
    }

    // 8. Create session
    const newSession = await Session.create(
      {
        schoolId,
        sessionName: session.sessionName.trim(),
        startDate: sessionStartDate,
        endDate: sessionEndDate,
        status: "UPCOMING",
        isCurrent: false,
      },
      { transaction }
    );

    // 9. Create all three terms
    const newTerms = await Term.bulkCreate(
      terms.map((term) => ({
        sessionId: newSession.id,
        termName: term.termName,
        startDate: new Date(term.startDate),
        endDate: new Date(term.endDate),
        status: "UPCOMING",
        isCurrent: false,
      })),
      { transaction }
    );

    // 10. Commit transaction
    await transaction.commit();

    // 11. Success response
    return res.status(201).json({
      success: true,
      message: "Academic session and terms created successfully.",
      data: {
        session: newSession,
        terms: newTerms,
      },
    });
  } catch (error) {
    // Rollback if transaction is still active
    if (!transaction.finished) {
      await transaction.rollback();
    }

    // Handle Sequelize unique constraint
    if (error.name === "SequelizeUniqueConstraintError") {
      return next(
        new AppError(
          "A session with this name already exists for this school.",
          409
        )
      );
    }

    return next(error);
  }
};


// Create a class and arm 
export const createClass = async (req, res, next) => {
  try {
    // 1. Get authenticated school
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return next(
        new AppError("Authenticated school not found.", 401)
      );
    }

    // 2. Support a single class object or an array
    const isSingleClass = !Array.isArray(req.body);
    const submittedClasses = isSingleClass
      ? [req.body]
      : req.body;

    // 3. Normalize class levels and arms
    const classesToCreate = submittedClasses.map(
      ({ classLevel, arm }) => ({
        schoolId,
        classLevel: classLevel.trim().toUpperCase(),
        arm: arm?.trim().toUpperCase() || null,
      })
    );

    // Case-insensitive comparison helpers
    const getLevelKey = (value) =>
      value.trim().toLowerCase();

    const getArmKey = (value) =>
      value?.trim().toLowerCase() || null;

    // 4. Reject duplicates and conflicting structures in the request
    const submittedByLevel = new Map();

    for (const item of classesToCreate) {
      const levelKey = getLevelKey(item.classLevel);
      const armKey = getArmKey(item.arm);

      if (!submittedByLevel.has(levelKey)) {
        submittedByLevel.set(levelKey, new Set());
      }

      const submittedArms = submittedByLevel.get(levelKey);

      // Reject duplicate level + arm combinations
      if (submittedArms.has(armKey)) {
        return next(
          new AppError(
            `Class "${item.classLevel}" with this arm already appears in the request.`,
            409
          )
        );
      }

      // An ungrouped class cannot coexist with named arms
      if (
        (armKey === null && submittedArms.size > 0) ||
        submittedArms.has(null)
      ) {
        return next(
          new AppError(
            `Class "${item.classLevel}" cannot have both an ungrouped class and arm-based classes.`,
            409
          )
        );
      }

      submittedArms.add(armKey);
    }

    // 5. Check existing records and create atomically
    const createdClasses = await dbConnection.transaction(
      async (transaction) => {
        // Lock the parent school row.
        // Concurrent class-creation requests for this school must wait
        // until the current transaction finishes.
        const school = await School.findByPk(schoolId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!school) {
          throw new AppError(
            "Authenticated school not found.",
            404
          );
        }

        // Fetch existing classes for this school.
        // Compare in JavaScript to handle different capitalization
        // in records created before this normalization.
        const existingClasses = await Class.findAll({
          where: { schoolId },
          transaction,
        });

        const existingByLevel = new Map();

        for (const existing of existingClasses) {
          const levelKey = getLevelKey(existing.classLevel);

          if (!existingByLevel.has(levelKey)) {
            existingByLevel.set(levelKey, []);
          }

          existingByLevel.get(levelKey).push(existing);
        }

        // Check every incoming class against existing records
        for (const item of classesToCreate) {
          const levelKey = getLevelKey(item.classLevel);
          const armKey = getArmKey(item.arm);

          const existingAtLevel =
            existingByLevel.get(levelKey) || [];

          for (const existing of existingAtLevel) {
            const existingArmKey = getArmKey(existing.arm);

            // Reject duplicate class + arm
            if (existingArmKey === armKey) {
              throw new AppError(
                `Class "${item.classLevel}" with this arm already exists for this school.`,
                409
              );
            }

            // Reject mixing ungrouped and arm-based classes
            if (
              existingArmKey === null ||
              armKey === null
            ) {
              throw new AppError(
                `Class "${item.classLevel}" cannot have both an ungrouped class and arm-based classes.`,
                409
              );
            }
          }
        }

        // Create the entire batch in the same transaction
        return Class.bulkCreate(classesToCreate, {
          transaction,
          validate: true,
        });
      }
    );

    // 6. Return a response matching the request format
    return res.status(201).json({
      success: true,
      message: isSingleClass
        ? "Class created successfully."
        : `${createdClasses.length} classes created successfully.`,
      data: isSingleClass
        ? { class: createdClasses[0] }
        : { classes: createdClasses },
    });
  } catch (error) {
    // Handle database uniqueness violations
    if (error.name === "SequelizeUniqueConstraintError") {
      return next(
        new AppError(
          "A class with the same level and arm already exists for this school.",
          409
        )
      );
    }

    return next(error);
  }
};


// Create a subject
export const createSubject = async (req, res, next) => {
  let transaction;

  try {
    // 1. Get authenticated school
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return next(new AppError("Authenticated school not found.", 401));
    }

    // 2. Support both single-subject and multiple-subject payloads
    const subjects = Array.isArray(req.body.subjects)
      ? req.body.subjects
      : [{ subjectName: req.body.subjectName }];

    // 3. Normalize subject names
    const normalizedSubjects = subjects.map((subject) => ({
      subjectName: subject.subjectName.trim(),
    }));

    // 4. Reject duplicate names within the submitted batch
    const submittedNames = normalizedSubjects.map(({ subjectName }) =>
      subjectName.toLocaleLowerCase()
    );

    if (new Set(submittedNames).size !== submittedNames.length) {
      return next(
        new AppError(
          "The submitted subjects contain duplicate names.",
          409
        )
      );
    }

    // 5. Start transaction
    transaction = await dbConnection.transaction();

    // 6. Check existing subjects belonging to this school
    const existingSubjects = await Subject.findAll({
      where: { schoolId },
      attributes: ["subjectName"],
      transaction,
    });

    const existingNames = new Set(
      existingSubjects.map((subject) =>
        subject.subjectName.trim().toLocaleLowerCase()
      )
    );

    const duplicateSubject = normalizedSubjects.find(({ subjectName }) =>
      existingNames.has(subjectName.toLocaleLowerCase())
    );

    if (duplicateSubject) {
      throw new AppError(
        `"${duplicateSubject.subjectName}" already exists for this school.`,
        409
      );
    }

    // 7. Create all submitted subjects in the same transaction
    const createdSubjects = await Subject.bulkCreate(
      normalizedSubjects.map(({ subjectName }) => ({
        schoolId,
        subjectName,
      })),
      {
        transaction,
        validate: true,
      }
    );

    await transaction.commit();

    // 8. Return the created subjects
    return res.status(201).json({
      success: true,
      message:
        createdSubjects.length === 1
          ? "Subject created successfully."
          : "Subjects created successfully.",
      data: {
        subjects: createdSubjects,
        // Retain compatibility with callers expecting data.subject
        subject: createdSubjects[0],
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    if (error.name === "SequelizeUniqueConstraintError") {
      return next(
        new AppError(
          "One or more subjects already exist for this school.",
          409
        )
      );
    }

    return next(error);
  }
};

export const saveWorkingDays = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;
    const { days } = req.body;

    // 1. Verify authenticated school
    if (!schoolId) {
      throw new AppError(
        "Authenticated school not found.",
        401
      );
    }

    // 2. Create or update the school's working days
    const savedWorkingDays = await dbConnection.transaction(
      async (transaction) => {
        // Lock the school row to serialize working-day saves
        // for this school.
        const school = await School.findByPk(schoolId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!school) {
          throw new AppError(
            "Authenticated school not found.",
            404
          );
        }

        const existingWorkingDays = await WorkingDay.findOne({
          where: { schoolId },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (existingWorkingDays) {
          await existingWorkingDays.update(
            { days },
            { transaction }
          );

          return existingWorkingDays;
        }

        return WorkingDay.create(
          {
            schoolId,
            days,
          },
          { transaction }
        );
      }
    );

    // 3. Return success response
    return res.status(200).json({
      success: true,
      message: "School working days saved successfully.",
      data: {
        workingDays: savedWorkingDays,
      },
    });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return next(
        new AppError(
          "Working days were saved by another request. Please try again.",
          409
        )
      );
    }

    return next(error);
  }
};

export const getAcademicSetupProgress = async (req, res, next) => {
  try {
    // 1. Get authenticated school
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return next(
        new AppError("Authenticated school not found.", 401)
      );
    }

    // 2. Check Sessions & Terms
    const sessionCount = await Session.count({
      where: { schoolId },
    });

    const sessionsAndTermsCompleted = sessionCount > 0;

    // 3. Check Classes & Arms
    const classCount = await Class.count({
      where: { schoolId },
    });

    const classesAndArmsCompleted = classCount > 0;

    // 4. Check Subjects
    const subjectCount = await Subject.count({
      where: { schoolId },
    });

    const subjectsCompleted = subjectCount > 0;

    // 5. Check Working Days
    const workingDaysCount = await WorkingDay.count({
      where: { schoolId },
    });

    const workingDaysCompleted = workingDaysCount > 0;

    // 6. Calculate progress across four setup steps
    const steps = {
      sessionsAndTerms: sessionsAndTermsCompleted,
      classesAndArms: classesAndArmsCompleted,
      subjects: subjectsCompleted,
      workingDays: workingDaysCompleted,
    };

    const completedSteps = Object.values(steps).filter(
      Boolean
    ).length;

    const progress = Math.round(
      (completedSteps / 4) * 100
    );

    // 7. Success response
    return res.status(200).json({
      success: true,
      data: {
        progress,
        completed: progress === 100,
        steps,
      },
    });
  } catch (error) {
    return next(error);
  }
};