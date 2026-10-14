import Subject from "../models/Subject.js";
import AppError from "../utils/AppError.js";

export const getAllSubjects = async (req, res, next) => {
  try {
    // 1. Get authenticated school
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return next(
        new AppError("Authenticated school not found.", 401)
      );
    }

    // 2. Get all subjects belonging to this school
    const subjects = await Subject.findAll({
      where: { schoolId },
      order: [["subjectName", "ASC"]],
    });

    // 3. Calculate subject summary
    const totalSubjects = subjects.length;

    const activeSubjects = subjects.filter(
      (subject) => subject.isActive
    ).length;

    const inactiveSubjects = totalSubjects - activeSubjects;

    // 4. Return subjects and summary
    return res.status(200).json({
      success: true,
      message: "Subjects retrieved successfully.",
      data: {
        subjects,
        summary: {
          totalSubjects,
          activeSubjects,
          inactiveSubjects,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};


export const updateSubject = async (req, res, next) => {
  try {
    // 1. Get authenticated school
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return next(
        new AppError("Authenticated school not found.", 401)
      );
    }

    // 2. Get subject ID and validated data
    const { subjectId } = req.params;
    const { subjectName } = req.body;

    // 3. Find subject belonging to this school
    const subject = await Subject.findOne({
      where: {
        id: subjectId,
        schoolId,
      },
    });

    if (!subject) {
      return next(
        new AppError("Subject not found for this school.", 404)
      );
    }

    // 4. Check for duplicate subject name
    const existingSubject = await Subject.findOne({
      where: {
        schoolId,
        subjectName,
      },
    });

    if (existingSubject && existingSubject.id !== subject.id) {
      return next(
        new AppError(
          "This subject already exists for this school.",
          409
        )
      );
    }

    // 5. Update subject
    await subject.update({ subjectName });

    // 6. Return updated subject
    return res.status(200).json({
      success: true,
      message: "Subject updated successfully.",
      data: {
        subject,
      },
    });
  } catch (error) {
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

export const activateSubject = async (req, res, next) => {
  try {
    // 1. Get authenticated school
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return next(
        new AppError("Authenticated school not found.", 401)
      );
    }

    // 2. Get subject ID
    const { subjectId } = req.params;

    // 3. Find subject belonging to this school
    const subject = await Subject.findOne({
      where: {
        id: subjectId,
        schoolId,
      },
    });

    if (!subject) {
      return next(
        new AppError("Subject not found for this school.", 404)
      );
    }

    // 4. Check current status
    if (subject.isActive) {
      return next(
        new AppError("This subject is already active.", 400)
      );
    }

    // 5. Reactivate subject
    await subject.update({
      isActive: true,
    });

    // 6. Return updated subject
    return res.status(200).json({
      success: true,
      message: "Subject activated successfully.",
      data: {
        subject,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const deactivateSubject = async (req, res, next) => {
  try {
    // 1. Get authenticated school
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return next(
        new AppError("Authenticated school not found.", 401)
      );
    }

    // 2. Get subject ID
    const { subjectId } = req.params;

    // 3. Find subject belonging to this school
    const subject = await Subject.findOne({
      where: {
        id: subjectId,
        schoolId,
      },
    });

    if (!subject) {
      return next(
        new AppError("Subject not found for this school.", 404)
      );
    }

    // 4. Check current status
    if (!subject.isActive) {
      return next(
        new AppError("This subject is already inactive.", 400)
      );
    }

    // 5. Deactivate without deleting historical records
    await subject.update({
      isActive: false,
    });

    // 6. Return updated subject
    return res.status(200).json({
      success: true,
      message: "Subject deactivated successfully.",
      data: {
        subject,
      },
    });
  } catch (error) {
    return next(error);
  }
};