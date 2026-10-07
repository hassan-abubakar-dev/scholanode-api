import { dbConnection } from "../config/db.js";
import Session from "../models/Session.js";
import  Term  from "../models/Term.js";
import Class from "../models/Class.js";
import Subject from "../models/Subject.js";
import AppError from "../utils/AppError.js";

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

    // 3. Validate session
    if (!session?.sessionName?.trim()) {
      await transaction.rollback();
      return next(
        new AppError("Session name is required.", 400)
      );
    }

    if (!session?.startDate) {
      await transaction.rollback();
      return next(
        new AppError("Session start date is required.", 400)
      );
    }

    if (!session?.endDate) {
      await transaction.rollback();
      return next(
        new AppError("Session end date is required.", 400)
      );
    }

    // 4. Validate session dates
    const sessionStartDate = new Date(session.startDate);
    const sessionEndDate = new Date(session.endDate);

    if (
      Number.isNaN(sessionStartDate.getTime()) ||
      Number.isNaN(sessionEndDate.getTime())
    ) {
      await transaction.rollback();
      return next(
        new AppError("Invalid session date provided.", 400)
      );
    }

    if (sessionStartDate >= sessionEndDate) {
      await transaction.rollback();
      return next(
        new AppError(
          "Session end date must be after the start date.",
          400
        )
      );
    }

    // 5. Validate terms
    if (!Array.isArray(terms) || terms.length !== 3) {
      await transaction.rollback();
      return next(
        new AppError(
          "Exactly three terms are required: first, second and third term.",
          400
        )
      );
    }

    const requiredTerms = [
      "FIRST_TERM",
      "SECOND_TERM",
      "THIRD_TERM",
    ];

    const providedTermNames = terms.map(
      (term) => term?.termName
    );

    const hasAllTerms = requiredTerms.every((termName) =>
      providedTermNames.includes(termName)
    );

    if (!hasAllTerms) {
      await transaction.rollback();
      return next(
        new AppError(
          "Terms must include FIRST_TERM, SECOND_TERM and THIRD_TERM.",
          400
        )
      );
    }

    // 6. Validate each term
    for (const term of terms) {
      if (!term?.termName) {
        await transaction.rollback();
        return next(
          new AppError("Each term must have a term name.", 400)
        );
      }

      if (!term?.startDate) {
        await transaction.rollback();
        return next(
          new AppError(
            `${term.termName} start date is required.`,
            400
          )
        );
      }

      if (!term?.endDate) {
        await transaction.rollback();
        return next(
          new AppError(
            `${term.termName} end date is required.`,
            400
          )
        );
      }

      const termStartDate = new Date(term.startDate);
      const termEndDate = new Date(term.endDate);

      if (
        Number.isNaN(termStartDate.getTime()) ||
        Number.isNaN(termEndDate.getTime())
      ) {
        await transaction.rollback();
        return next(
          new AppError(
            `Invalid date provided for ${term.termName}.`,
            400
          )
        );
      }

      if (termStartDate >= termEndDate) {
        await transaction.rollback();
        return next(
          new AppError(
            `${term.termName} end date must be after its start date.`,
            400
          )
        );
      }

      // Term must fall within the session
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

    // 2. Get request data
    const { classLevel, arm } = req.body;

    // 3. Validate class level
    if (!classLevel?.trim()) {
      return next(
        new AppError("Class level is required.", 400)
      );
    }

    // 4. Validate arm
    if (!arm?.trim()) {
      return next(
        new AppError("Class arm is required.", 400)
      );
    }

    // 5. Check for duplicate class and arm
    const existingClass = await Class.findOne({
      where: {
        schoolId,
        classLevel: classLevel.trim(),
        arm: arm.trim(),
      },
    });

    if (existingClass) {
      return next(
        new AppError(
          "This class and arm already exists for this school.",
          409
        )
      );
    }

    // 6. Create class without a form master
    const newClass = await Class.create({
      schoolId,
      classLevel: classLevel.trim(),
      arm: arm.trim(),
    });

    // 7. Success response
    return res.status(201).json({
      success: true,
      message: "Class created successfully.",
      data: {
        class: newClass,
      },
    });
  } catch (error) {
    // Handle Sequelize unique constraint
    if (error.name === "SequelizeUniqueConstraintError") {
      return next(
        new AppError(
          "This class and arm already exists for this school.",
          409
        )
      );
    }

    return next(error);
  }
};


// Create a subject
export const createSubject = async (req, res, next) => {
  try {
    // 1. Get authenticated school
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return next(
        new AppError("Authenticated school not found.", 401)
      );
    }

    // 2. Get request data
    const { subjectName } = req.body;

    // 3. Validate subject name
    if (!subjectName?.trim()) {
      return next(
        new AppError("Subject name is required.", 400)
      );
    }

    // 4. Check for duplicate subject
    const existingSubject = await Subject.findOne({
      where: {
        schoolId,
        subjectName: subjectName.trim(),
      },
    });

    if (existingSubject) {
      return next(
        new AppError(
          "This subject already exists for this school.",
          409
        )
      );
    }

    // 5. Create subject
    const newSubject = await Subject.create({
      schoolId,
      subjectName: subjectName.trim(),
    });

    // 6. Success response
    return res.status(201).json({
      success: true,
      message: "Subject created successfully.",
      data: {
        subject: newSubject,
      },
    });
  } catch (error) {
    // Handle Sequelize unique constraint
    if (error.name === "SequelizeUniqueConstraintError") {
      return next(
        new AppError(
          "This subject already exists for this school.",
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
      where: {
        schoolId,
      },
    });

    const sessionsAndTermsCompleted = sessionCount > 0;

    // 3. Check Classes & Arms
    const classCount = await Class.count({
      where: {
        schoolId,
      },
    });

    const classesAndArmsCompleted = classCount > 0;

    // 4. Check Subjects
    const subjectCount = await Subject.count({
      where: {
        schoolId,
      },
    });

    const subjectsCompleted = subjectCount > 0;

    // 5. Calculate progress
    const completedSteps = [
      sessionsAndTermsCompleted,
      classesAndArmsCompleted,
      subjectsCompleted,
    ].filter(Boolean).length;

    const progress = Math.round(
      (completedSteps / 3) * 100
    );

    // 6. Success response
    return res.status(200).json({
      success: true,
      data: {
        progress,
        completed: progress === 100,
        steps: {
          sessionsAndTerms: sessionsAndTermsCompleted,
          classesAndArms: classesAndArmsCompleted,
          subjects: subjectsCompleted,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};