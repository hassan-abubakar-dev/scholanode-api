import { Op } from "sequelize";

import { dbConnection } from "../config/db.js";
import {
  Class,
  Subject,
  ClassSubject,
} from "../relationships/associations.js";

import { handleControllerError } from "../utils/controllerError.js";
import AppError from "../utils/AppError.js";



// ============================================
// GET SUBJECTS ASSIGNED TO A CLASS
// ============================================

export const getClassSubjects = async (req, res, next) => {
  try {
    const { classId } = req.params;
    const { schoolId } = req.user;

    const schoolClass = await Class.findOne({
      where: {
        id: classId,
        schoolId,
      },
    });

    if (!schoolClass) {
      return res.status(404).json({
        success: false,
        message: "Class not found.",
      });
    }

    const classSubjects = await ClassSubject.findAll({
      where: {
        schoolId,
        classId,
      },
      include: [
        {
          model: Subject,
          as: "subject",
          attributes: ["id", "subjectName", "isActive"],
          required: true,
        },
      ],
      order: [[{ model: Subject, as: "subject" }, "subjectName", "ASC"]],
    });

    return res.status(200).json({
      success: true,
      message: "Class subjects retrieved successfully.",
      data: classSubjects,
    });
  } catch (error) {
    handleControllerError(error, next, req, "CLASS_SUBJECT_ERROR", "Unable to process class subject request.");
  }
};

// ============================================
// ASSIGN SUBJECTS TO SELECTED CLASS ARMS
// ============================================

export const assignSubjectToClass = async (req, res, next) => {
  try {
    const { classId: anchorClassId } = req.params;
    const { schoolId } = req.user;
    const { subjectIds, classIds } = req.body;

    const result = await dbConnection.transaction(async (transaction) => {
      // 1. Verify the selected/anchor class
      const anchorClass = await Class.findOne({
        where: {
          id: anchorClassId,
          schoolId,
        },
        transaction,
      });

      if (!anchorClass) {
        throw new AppError("Selected class was not found.", 404);
      }

      // The anchor class must be included among the target classes.
      if (!classIds.includes(anchorClassId)) {
        throw new AppError(
          "The selected class must be included in the target classes."
        , 400);
      }

      // 2. Verify all target classes belong to this school
      const targetClasses = await Class.findAll({
        where: {
          id: {
            [Op.in]: classIds,
          },
          schoolId,
        },
        transaction,
      });

      if (targetClasses.length !== classIds.length) {
        throw new AppError(
          "One or more selected classes are invalid."
        );
      }

      // 3. Ensure every target belongs to the same class level
      const differentLevel = targetClasses.some(
        (schoolClass) =>
          schoolClass.classLevel !== anchorClass.classLevel
      );

      if (differentLevel) {
        throw createError(
          "Subjects can only be assigned to classes within the same class level."
        , 400);
      }

      // 4. Verify all subjects belong to this school and are active
      const subjects = await Subject.findAll({
        where: {
          id: {
            [Op.in]: subjectIds,
          },
          schoolId,
          isActive: true,
        },
        transaction,
      });

      if (subjects.length !== subjectIds.length) {
        throw new AppError(
          "One or more selected subjects are invalid or inactive."
        );
      }

      // 5. Generate every subject/class combination
      const combinations = [];

      for (const targetClassId of classIds) {
        for (const subjectId of subjectIds) {
          combinations.push({
            schoolId,
            classId: targetClassId,
            subjectId,
          });
        }
      }

      // 6. Find combinations that already exist
      const existingAssignments = await ClassSubject.findAll({
        where: {
          schoolId,
          classId: {
            [Op.in]: classIds,
          },
          subjectId: {
            [Op.in]: subjectIds,
          },
        },
        attributes: ["classId", "subjectId"],
        transaction,
      });

      const existingKeys = new Set(
        existingAssignments.map(
          (item) => `${item.classId}:${item.subjectId}`
        )
      );

      const newAssignments = combinations.filter(
        (item) =>
          !existingKeys.has(`${item.classId}:${item.subjectId}`)
      );

      // 7. Create only new associations
      if (newAssignments.length > 0) {
        await ClassSubject.bulkCreate(newAssignments, {
          transaction,
        });
      }

      return {
        assignedCount: newAssignments.length,
        skippedCount: combinations.length - newAssignments.length,
        selectedClassCount: classIds.length,
        selectedSubjectCount: subjectIds.length,
      };
    });

    return res.status(201).json({
      success: true,
      message: "Subject assignment completed successfully.",
      data: result,
    });
  } catch (error) {
    handleControllerError(error, next, req, "CLASS_SUBJECT_ERROR", "Unable to process class subject request.");
  }
};

// ============================================
// REMOVE SUBJECT FROM A CLASS
// ============================================

export const removeSubjectFromClass = async (req, res, next) => {
  try {
    const { classId, subjectId } = req.params;
    const { schoolId } = req.user;

    // 1. Verify class belongs to this school
    const schoolClass = await Class.findOne({
      where: {
        id: classId,
        schoolId,
      },
    });

    if (!schoolClass) {
      return res.status(404).json({
        success: false,
        message: "Class not found.",
      });
    }

    // 2. Find the specific association
    const classSubject = await ClassSubject.findOne({
      where: {
        schoolId,
        classId,
        subjectId,
      },
    });

    if (!classSubject) {
      return res.status(404).json({
        success: false,
        message: "This subject is not assigned to the selected class.",
      });
    }

    // 3. Delete only the class-subject association
    await classSubject.destroy();

    return res.status(200).json({
      success: true,
      message:
        "Subject removed from this class successfully. The school subject record was not deleted.",
    });
  } catch (error) {
    handleControllerError(error, next, req, "CLASS_SUBJECT_ERROR", "Unable to process class subject request.");
  }
};