
import { Class, User, Student } from "../relationships/associations.js";
import AppError from "../utils/AppError.js";
import {dbConnection} from "../config/db.js";
import { Op } from "sequelize";

// Get all classes belonging to the authenticated school
export const getSchoolClasses = async (req, res, next) => {
  try {
    // 1. Get authenticated school
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return next(
        new AppError("Authenticated school not found.", 401)
      );
    }

    // 2. Get all classes with their form masters and students
    const classes = await Class.findAll({
      where: {
        schoolId,
      },

      attributes: [
        "id",
        "schoolId",
        "classLevel",
        "arm",
        "formMasterId",
        "createdAt",
        "updatedAt",
      ],

      include: [
  {
    model: User,
    as: "formMaster",
    attributes: [
      "id",
      "loginId",
      "firstName",
      "surName",
      "role",
    ],
    required: false,
  },
],
      order: [
        ["classLevel", "ASC"],
        ["arm", "ASC"],
      ],
    });

    // 3. Success response
    return res.status(200).json({
      success: true,
      message: "Classes retrieved successfully.",
      count: classes.length,
      data: {
        classes,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const assignFormMaster = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;
    const role = req.user?.role;
    const { classId } = req.params;
    const { formMasterId } = req.body;

    // 1. Verify authenticated school
    if (!schoolId) {
      return next(
        new AppError("Authenticated school not found.", 401)
      );
    }

    // 2. Restrict who can manage assignments
    const allowedRoles = [
      "LEADER",
      "VICE_LEADER",
      "ADMINISTRATOR",
    ];

    if (!allowedRoles.includes(role)) {
      return next(
        new AppError(
          "You are not authorized to assign form masters.",
          403
        )
      );
    }

    // 3. Require the formMasterId property.
    // Use null to remove an existing assignment.
    if (
      !Object.prototype.hasOwnProperty.call(
        req.body,
        "formMasterId"
      )
    ) {
      return next(
        new AppError(
          "Form master ID is required. Use null to remove an assignment.",
          400
        )
      );
    }

    if (
      formMasterId !== null &&
      (typeof formMasterId !== "string" ||
        !formMasterId.trim())
    ) {
      return next(
        new AppError(
          "Form master ID must be a valid ID or null.",
          400
        )
      );
    }

    const updatedClass = await dbConnection.transaction(
      async (transaction) => {
        // 4. Find the class within the authenticated school
        const classRecord = await Class.findOne({
          where: {
            id: classId,
            schoolId,
          },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!classRecord) {
          throw new AppError(
            "Class not found for this school.",
            404
          );
        }

        // 5. If an ID was provided, verify eligible staff
        if (formMasterId !== null) {
          const normalizedFormMasterId = formMasterId.trim();

          const formMaster = await User.findOne({
            where: {
              id: normalizedFormMasterId,
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
            transaction,
          });

          if (!formMaster) {
            throw new AppError(
              "The selected form master is not an active staff member of this school.",
              400
            );
          }

          // 6. Ensure this staff member is not assigned
          // as form master to another class.
          const existingAssignment = await Class.findOne({
            where: {
              schoolId,
              formMasterId: normalizedFormMasterId,
              id: {
                [Op.ne]: classRecord.id,
              },
            },
            attributes: ["id", "classLevel", "arm"],
            transaction,
          });

          if (existingAssignment) {
            throw new AppError(
              "This staff member is already assigned as a form master to another class.",
              409
            );
          }
        }

        // 7. Assign, change, or remove the form master
        await classRecord.update(
          {
            formMasterId:
              formMasterId === null
                ? null
                : formMasterId.trim(),
          },
          { transaction }
        );

        // 8. Return the updated class with its form master
        return Class.findByPk(classRecord.id, {
          attributes: [
            "id",
            "schoolId",
            "classLevel",
            "arm",
            "formMasterId",
          ],
          include: [
            {
              model: User,
              as: "formMaster",
              attributes: [
                "id",
                "firstName",
                "surName",
                "loginId",
              ],
              required: false,
            },
          ],
          transaction,
        });
      }
    );

    return res.status(200).json({
      success: true,
      message: updatedClass.formMaster
        ? "Form master assigned successfully."
        : "Form master assignment removed successfully.",
      data: {
        class: updatedClass,
      },
    });
  } catch (error) {
    return next(error);
  }
};