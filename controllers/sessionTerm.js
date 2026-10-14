import { Session, Term } from "../relationships/associations.js";
import AppError from "../utils/AppError.js";

import { dbConnection } from "../config/db.js";

export const getAllSessionsAndTerms = async (req, res, next) => {
  try {
    // 1. Get authenticated school
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return next(
        new AppError("Authenticated school not found.", 401)
      );
    }

    // 2. Get all sessions and their terms for this school
    const sessions = await Session.findAll({
      where: {
        schoolId,
      },
      include: [
        {
          model: Term,
          as: "terms",
        },
      ],
order: [
  ["createdAt", "DESC"],
  [{ model: Term, as: "terms" }, "startDate", "ASC"],
],

    });

    // 3. Success response
    return res.status(200).json({
      success: true,
      message: "Academic sessions and terms retrieved successfully.",
      data: {
        sessions,
      },
    });
  } catch (error) {
    return next(error);
  }
};


export const updateSessionWithTerms = async (req, res, next) => {
  const transaction = await dbConnection.transaction();

  try {
    const schoolId = req.user?.schoolId;
    const { sessionId } = req.params;
    const { session: sessionData, terms: termData } = req.body;

    if (!schoolId) {
      throw new AppError("Authenticated school not found.", 401);
    }

    const existingSession = await Session.findOne({
      where: { id: sessionId, schoolId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!existingSession) {
      throw new AppError("Academic session not found.", 404);
    }

    if (existingSession.status === "COMPLETED") {
      throw new AppError(
        "Completed academic sessions cannot be edited.",
        400
      );
    }

    const duplicateSession = await Session.findOne({
      where: {
        schoolId,
        sessionName: sessionData.sessionName.trim(),
      },
      transaction,
    });

    if (
      duplicateSession &&
      String(duplicateSession.id) !== String(existingSession.id)
    ) {
      throw new AppError(
        "A session with this name already exists for this school.",
        409
      );
    }

    const sessionStartDate = new Date(sessionData.startDate);
    const sessionEndDate = new Date(sessionData.endDate);

    const orderedTerms = [...termData].sort(
      (a, b) => new Date(a.startDate) - new Date(b.startDate)
    );

    for (let i = 0; i < orderedTerms.length; i++) {
      const term = orderedTerms[i];
      const termStartDate = new Date(term.startDate);
      const termEndDate = new Date(term.endDate);

      if (
        termStartDate < sessionStartDate ||
        termEndDate > sessionEndDate
      ) {
        throw new AppError(
          `${term.termName} dates must fall within the session dates.`,
          400
        );
      }

      if (
        i > 0 &&
        termStartDate <= new Date(orderedTerms[i - 1].endDate)
      ) {
        throw new AppError(
          "Each term must start after the previous term ends.",
          400
        );
      }
    }

    const existingTerms = await Term.findAll({
      where: { sessionId: existingSession.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (existingTerms.length !== 3) {
      throw new AppError(
        "This session must have exactly three terms to be edited.",
        409
      );
    }

    const termsByName = new Map(
      existingTerms.map((term) => [term.termName, term])
    );

    for (const termDataItem of termData) {
      const existingTerm = termsByName.get(termDataItem.termName);

      if (!existingTerm) {
        throw new AppError(
          `The existing ${termDataItem.termName} was not found.`,
          409
        );
      }

      // Keep completed terms immutable.
      if (existingTerm.status === "COMPLETED") {
        const datesChanged =
          new Date(existingTerm.startDate).getTime() !==
            new Date(termDataItem.startDate).getTime() ||
          new Date(existingTerm.endDate).getTime() !==
            new Date(termDataItem.endDate).getTime();

        if (datesChanged) {
          throw new AppError(
            `Dates for completed ${termDataItem.termName} cannot be changed.`,
            400
          );
        }
      }
    }

    await existingSession.update(
      {
        sessionName: sessionData.sessionName.trim(),
        startDate: sessionStartDate,
        endDate: sessionEndDate,
      },
      { transaction }
    );

    for (const termDataItem of termData) {
      const existingTerm = termsByName.get(termDataItem.termName);

      await existingTerm.update(
        {
          startDate: new Date(termDataItem.startDate),
          endDate: new Date(termDataItem.endDate),
        },
        { transaction }
      );
    }

    await transaction.commit();

    const updatedSession = await Session.findOne({
      where: { id: existingSession.id, schoolId },
      include: [{ model: Term, as: "terms" }],
    });

    return res.status(200).json({
      success: true,
      message: "Academic session and terms updated successfully.",
      data: { session: updatedSession },
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

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



// Activate the first eligible session for the authenticated school.
export const activateSession = async (req, res, next) => {
  const transaction = await dbConnection.transaction();

  try {
    const schoolId = req.user?.schoolId;
    const { sessionId } = req.params;

    if (!schoolId) {
      throw new AppError("Authenticated school not found.", 401);
    }

    // Lock this school's sessions to prevent conflicting activations.
const sessions = await Session.findAll({
  where: { schoolId },
  order: [
    ["createdAt", "ASC"],
  ],
  transaction,
  lock: transaction.LOCK.UPDATE,
});

    const session = sessions.find(
      (item) => String(item.id) === String(sessionId)
    );

    if (!session) {
      throw new AppError("Academic session not found.", 404);
    }

    if (session.status !== "UPCOMING") {
      throw new AppError(
        "Only an upcoming session can be activated.",
        400
      );
    }

    if (sessions.some((item) => item.status === "ACTIVE")) {
      throw new AppError(
        "Complete the active session before activating another session.",
        409
      );
    }

    // Earlier sessions must be completed first.
    const firstUncompletedSession = sessions.find(
      (item) => item.status !== "COMPLETED"
    );

    if (
      !firstUncompletedSession ||
      String(firstUncompletedSession.id) !== String(session.id)
    ) {
      throw new AppError(
        "Activate sessions in chronological order. Complete earlier sessions first.",
        409
      );
    }

    await session.update(
      { status: "ACTIVE", isCurrent: true },
      { transaction }
    );

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Academic session activated successfully.",
      data: { session },
    });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    return next(error);
  }
};

// Complete an active session only after all its terms are completed.
export const completeSession = async (req, res, next) => {
  const transaction = await dbConnection.transaction();

  try {
    const schoolId = req.user?.schoolId;
    const { sessionId } = req.params;

    if (!schoolId) {
      throw new AppError("Authenticated school not found.", 401);
    }

    const session = await Session.findOne({
      where: { id: sessionId, schoolId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!session) {
      throw new AppError("Academic session not found.", 404);
    }

    if (session.status !== "ACTIVE" || !session.isCurrent) {
      throw new AppError(
        "Only the active session can be completed.",
        400
      );
    }

    const terms = await Term.findAll({
      where: { sessionId: session.id },
      order: [
        ["startDate", "ASC"],
        ["createdAt", "ASC"],
      ],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (terms.length !== 3) {
      throw new AppError(
        "This session must have exactly three terms before it can be completed.",
        409
      );
    }

    if (terms.some((term) => term.status !== "COMPLETED")) {
      throw new AppError(
        "Complete all three terms before completing the session.",
        409
      );
    }

    await session.update(
      { status: "COMPLETED", isCurrent: false },
      { transaction }
    );

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Academic session completed successfully.",
      data: { session },
    });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    return next(error);
  }
};

// Activate the next eligible term in the active session.

export const activateTerm = async (req, res, next) => {
  const transaction = await dbConnection.transaction();

  try {
    const schoolId = req.user?.schoolId;
    const { sessionId, termId } = req.params;

    if (!schoolId) {
      throw new AppError("Authenticated school not found.", 401);
    }

    // Lock the session first, then its terms.
    const session = await Session.findOne({
      where: { id: sessionId, schoolId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!session) {
      throw new AppError("Academic session not found.", 404);
    }

    if (session.status !== "ACTIVE" || !session.isCurrent) {
      throw new AppError(
        "Terms can only be activated in the active session.",
        400
      );
    }

    const terms = await Term.findAll({
      where: { sessionId: session.id },
      order: [
        ["startDate", "ASC"],
        ["createdAt", "ASC"],
      ],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const term = terms.find(
      (item) => String(item.id) === String(termId)
    );

    if (!term) {
      throw new AppError(
        "Term not found in this academic session.",
        404
      );
    }

    if (term.status !== "UPCOMING") {
      throw new AppError(
        "Only an upcoming term can be activated.",
        400
      );
    }

    // Only one term can be active in this session at a time.
    if (terms.some((item) => item.status === "ACTIVE")) {
      throw new AppError(
        "Complete the active term before activating another term.",
        409
      );
    }

    // Activate the requested eligible term, regardless of term order.
    await term.update(
      { status: "ACTIVE", isCurrent: true },
      { transaction }
    );

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Academic term activated successfully.",
      data: { term },
    });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    return next(error);
  }
};

// Complete the active term.
export const completeTerm = async (req, res, next) => {
  const transaction = await dbConnection.transaction();

  try {
    const schoolId = req.user?.schoolId;
    const { sessionId, termId } = req.params;

    if (!schoolId) {
      throw new AppError("Authenticated school not found.", 401);
    }

    const session = await Session.findOne({
      where: { id: sessionId, schoolId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!session) {
      throw new AppError("Academic session not found.", 404);
    }

    if (session.status !== "ACTIVE" || !session.isCurrent) {
      throw new AppError(
        "A term can only be completed in the active session.",
        400
      );
    }

    const term = await Term.findOne({
      where: { id: termId, sessionId: session.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!term) {
      throw new AppError(
        "Term not found in this academic session.",
        404
      );
    }

    if (term.status !== "ACTIVE" || !term.isCurrent) {
      throw new AppError(
        "Only the active term can be completed.",
        400
      );
    }

    await term.update(
      { status: "COMPLETED", isCurrent: false },
      { transaction }
    );

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Academic term completed successfully.",
      data: { term },
    });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    return next(error);
  }
};
