
import { Op } from "sequelize";
import { dbConnection } from "../config/db.js";

import {
  School,
  Owner,
  Class,
  Session,
  Term,
  AssessmentConfiguration,
  AssessmentComponent,
  TermAssessmentConfiguration,
} from "../relationships/associations.js";

import AppError from "../utils/AppError.js";
import { handleControllerError } from "../utils/controllerError.js";

// ============================================================
// CONSTANTS
// ============================================================

const VALID_SECTIONS = [
  "EARLY_YEARS",
  "PRIMARY",
  "JUNIOR_SECONDARY",
  "SENIOR_SECONDARY",
];

const WRITE_ROLES = [
  "LEADER",
  "VICE_LEADER",
  "EXAM_OFFICER",
];

const READ_ROLES = [
  "LEADER",
  "VICE_LEADER",
  "ADMINISTRATOR",
  "EXAM_OFFICER",
];

// ============================================================
// ERROR HANDLING
// ============================================================

const handleError = (error, req, next) =>
  handleControllerError(
    error,
    next,
    req,
    "ASSESSMENT_CONFIGURATION_CONTROLLER_ERROR",
    "Unable to process the assessment configuration request. Please try again."
  );

// ============================================================
// AUTHORIZATION
// ============================================================

const assertAssessmentReadAccess = async (req) => {
  const { id: userId, schoolId, role } = req.user || {};

  if (!userId || !schoolId) {
    throw new AppError(
      "Authenticated school or user not found.",
      401
    );
  }

  if (READ_ROLES.includes(role)) {
    return;
  }

  const owner = await Owner.findOne({
    where: {
      userId,
      schoolId,
    },
  });

  if (!owner) {
    throw new AppError(
      "You are not authorized to view assessment configurations.",
      403
    );
  }
};

const assertAssessmentWriteAccess = (req) => {
  if (!WRITE_ROLES.includes(req.user?.role)) {
    throw new AppError(
      "Only the Leader, Vice Leader, or Examination Officer can manage assessment rules.",
      403
    );
  }
};

// ============================================================
// COMMON HELPERS
// ============================================================

const getSchoolId = (req) => {
  const schoolId = req.user?.schoolId;

  if (!schoolId) {
    throw new AppError(
      "Authenticated school not found.",
      401
    );
  }

  return schoolId;
};

const validateEducationSection = (educationSection) => {
  if (!VALID_SECTIONS.includes(educationSection)) {
    throw new AppError(
      "Invalid educational section.",
      400
    );
  }
};

// ============================================================
// GET CURRENT ACTIVE TERM
// ============================================================

const getCurrentActiveTerm = async (schoolId) => {
  return Term.findOne({
    where: {
      status: "ACTIVE",
      isCurrent: true,
    },
    include: [
      {
        model: Session,
        as: "session",
        where: {
          schoolId,
          status: "ACTIVE",
          isCurrent: true,
        },
        attributes: [
          "id",
          "sessionName",
          "status",
          "startDate",
          "endDate",
        ],
        required: true,
      },
    ],
  });
};

// ============================================================
// DETERMINE NEXT ELIGIBLE TERM FOR A NEW VERSION
// ============================================================

const getNextAssessmentTerm = async ({
  schoolId,
  educationSection,
  transaction,
}) => {
  // 1. Find the currently active term.

  const activeTerm = await Term.findOne({
    where: {
      status: "ACTIVE",
      isCurrent: true,
    },
    include: [
      {
        model: Session,
        as: "session",
        where: {
          schoolId,
          status: "ACTIVE",
          isCurrent: true,
        },
        attributes: [
          "id",
          "sessionName",
          "status",
          "startDate",
          "endDate",
        ],
        required: true,
      },
    ],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  // 2. Find the latest term already assigned a configuration
  // for this educational section.

  const latestAssignment =
    await TermAssessmentConfiguration.findOne({
      where: {
        schoolId,
        educationSection,
      },
      include: [
        {
          model: Term,
          as: "term",
          required: true,
          include: [
            {
              model: Session,
              as: "session",
              where: {
                schoolId,
              },
              attributes: [
                "id",
                "sessionName",
                "status",
                "startDate",
                "endDate",
              ],
              required: true,
            },
          ],
        },
      ],
      order: [
        [
          { model: Term, as: "term" },
          "endDate",
          "DESC",
        ],
        ["createdAt", "DESC"],
      ],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

  const latestAssignedTerm = latestAssignment?.term || null;

  // 3. Choose whichever is chronologically later.

  let anchorTerm = activeTerm;

  if (
    latestAssignedTerm &&
    (
      !anchorTerm ||
      new Date(latestAssignedTerm.endDate) >
        new Date(anchorTerm.endDate)
    )
  ) {
    anchorTerm = latestAssignedTerm;
  }

  if (!anchorTerm) {
    throw new AppError(
      "No active term or existing assessment term assignment was found. Complete the initial assessment setup first.",
      409
    );
  }

  // 4. Retrieve upcoming terms across the school's sessions.

  const upcomingTerms = await Term.findAll({
    where: {
      status: "UPCOMING",
      isCurrent: false,
    },
    include: [
      {
        model: Session,
        as: "session",
        where: {
          schoolId,
          status: {
            [Op.in]: ["ACTIVE", "UPCOMING"],
          },
        },
        attributes: [
          "id",
          "sessionName",
          "status",
          "startDate",
          "endDate",
        ],
        required: true,
      },
    ],
    order: [
      ["startDate", "ASC"],
      ["createdAt", "ASC"],
    ],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  // 5. Select the first upcoming term after the anchor term.

  const anchorEndDate = new Date(anchorTerm.endDate);

  const nextTerm = upcomingTerms.find(
    (term) =>
      new Date(term.startDate) > anchorEndDate
  );

  if (!nextTerm) {
    throw new AppError(
      "There is no upcoming academic term after the current assessment period. Create the next academic session and its terms before updating the assessment configuration.",
      409
    );
  }

  return {
    nextTerm,
    anchorTerm,
  };
};

// ============================================================
// 1. GET ASSESSMENT SECTIONS
// ============================================================

export const getAssessmentSections = async (
  req,
  res,
  next
) => {
  try {
    await assertAssessmentReadAccess(req);

    const schoolId = getSchoolId(req);

    // Retrieve only educational sections that actually have classes.

    const classes = await Class.findAll({
      where: {
        schoolId,
        educationSection: {
          [Op.in]: VALID_SECTIONS,
        },
      },
      attributes: [
        "id",
        "educationSection",
        "classLevel",
        "arm",
      ],
      order: [
        ["educationSection", "ASC"],
        ["classLevel", "ASC"],
        ["arm", "ASC"],
      ],
    });

    // Group classes by their actual educational sections.

    const sectionMap = new Map();

    for (const classItem of classes) {
      const section = classItem.educationSection;

      if (!sectionMap.has(section)) {
        sectionMap.set(section, {
          educationSection: section,
          classes: [],
          arms: new Set(),
        });
      }

      const sectionData = sectionMap.get(section);

      const classData = classItem.toJSON();

      sectionData.classes.push(classData);

      if (classItem.arm) {
        sectionData.arms.add(classItem.arm);
      }
    }

    const sections = Array.from(sectionMap.values());

    if (!sections.length) {
      return res.status(200).json({
        success: true,
        message: "No educational sections with classes were found.",
        data: {
          currentTerm: null,
          sections: [],
        },
      });
    }

    // Get current active term.

    const currentTerm = await getCurrentActiveTerm(schoolId);

    // Retrieve all term assignments for this school.

    const assignments =
      await TermAssessmentConfiguration.findAll({
        where: {
          schoolId,
          educationSection: {
            [Op.in]: sections.map(
              (section) => section.educationSection
            ),
          },
        },
        include: [
          {
            model: Term,
            as: "term",
            required: true,
            include: [
              {
                model: Session,
                as: "session",
                where: {
                  schoolId,
                },
                attributes: [
                  "id",
                  "sessionName",
                  "status",
                ],
                required: true,
              },
            ],
          },
          {
            model: AssessmentConfiguration,
            as: "assessmentConfiguration",
            attributes: [
              "id",
              "versionNumber",
              "status",
              "effectiveFromTermId",
              "effectiveUntilTermId",
            ],
            required: true,
          },
        ],
        order: [
          ["createdAt", "DESC"],
        ],
      });

    // Prepare section configuration information.

    const result = sections.map((section) => {
      const sectionAssignments = assignments.filter(
        (assignment) =>
          assignment.educationSection === section.educationSection
      );

      const currentAssignment = currentTerm
        ? sectionAssignments.find(
            (assignment) =>
              assignment.termId === currentTerm.id
          )
        : null;

      const pendingAssignment = sectionAssignments.find(
        (assignment) =>
          assignment.assessmentConfiguration?.status === "PENDING"
      );

      const latestAssignment = sectionAssignments[0] || null;

      let configurationStatus = "NOT_CONFIGURED";

      if (currentAssignment) {
        configurationStatus = "CONFIGURED";
      } else if (pendingAssignment) {
        configurationStatus = "PENDING";
      } else if (latestAssignment) {
        configurationStatus = "ASSIGNED";
      }

      return {
        educationSection: section.educationSection,
        classes: section.classes,
        arms: Array.from(section.arms),

        hasConfiguration: sectionAssignments.length > 0,
        configurationStatus,

        currentConfiguration:
          currentAssignment?.assessmentConfiguration || null,

        pendingConfiguration:
          pendingAssignment?.assessmentConfiguration || null,

        latestAssignment: latestAssignment
          ? {
              term: latestAssignment.term,
              configuration:
                latestAssignment.assessmentConfiguration,
            }
          : null,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Assessment sections retrieved successfully.",
      data: {
        currentTerm,
        sections: result,
      },
    });
  } catch (error) {
    return handleError(error, req, next);
  }
};

// ============================================================
// 2. GET ASSESSMENT CONFIGURATIONS
// ============================================================

export const getAssessmentConfigurations = async (
  req,
  res,
  next
) => {
  try {
    await assertAssessmentReadAccess(req);

    const schoolId = getSchoolId(req);

    const { educationSection } = req.query;

    if (educationSection) {
      validateEducationSection(educationSection);
    }

    const where = {
      schoolId,
      ...(educationSection && { educationSection }),
    };

    const configurations =
      await AssessmentConfiguration.findAll({
        where,
        include: [
          {
            model: AssessmentComponent,
            as: "components",
            separate: true,
            order: [
              ["displayOrder", "ASC"],
            ],
          },
          {
            model: TermAssessmentConfiguration,
            as: "termAssignments",
            separate: true,
            include: [
              {
                model: Term,
                as: "term",
                include: [
                  {
                    model: Session,
                    as: "session",
                    attributes: [
                      "id",
                      "sessionName",
                      "status",
                    ],
                  },
                ],
              },
            ],
            order: [
              ["createdAt", "ASC"],
            ],
          },
        ],
        order: [
          ["educationSection", "ASC"],
          ["versionNumber", "DESC"],
        ],
      });

    return res.status(200).json({
      success: true,
      message: "Assessment configurations retrieved successfully.",
      data: {
        configurations,
      },
    });
  } catch (error) {
    return handleError(error, req, next);
  }
};

// ============================================================
// 3. UPDATE ASSESSMENT CONFIGURATION
// Creates a new PENDING version; never overwrites history.
// ============================================================

export const updateAssessmentConfiguration = async (
  req,
  res,
  next
) => {
  let transaction;

  try {
    assertAssessmentWriteAccess(req);

    const schoolId = getSchoolId(req);
    const updatedBy = req.user.id;

    const { educationSection } = req.params;
    const { components } = req.body;

    validateEducationSection(educationSection);

    transaction = await dbConnection.transaction();

    // Lock school row to serialize configuration changes
    // for the same school.

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

    // Ensure the educational section still has classes.

    const existingClass = await Class.findOne({
      where: {
        schoolId,
        educationSection,
      },
      transaction,
    });

    if (!existingClass) {
      throw new AppError(
        `No classes currently exist in ${educationSection}.`,
        400
      );
    }

    // Retrieve the latest version.

    const previousConfiguration =
      await AssessmentConfiguration.findOne({
        where: {
          schoolId,
          educationSection,
        },
        order: [
          ["versionNumber", "DESC"],
        ],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

    if (!previousConfiguration) {
      throw new AppError(
        "The initial assessment configuration has not been created for this section.",
        409
      );
    }

    // Do not allow another pending version for the same section.

    const existingPendingConfiguration =
      await AssessmentConfiguration.findOne({
        where: {
          schoolId,
          educationSection,
          status: "PENDING",
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

    if (existingPendingConfiguration) {
      throw new AppError(
        "A pending assessment configuration already exists for this section. It must become effective before another version can be created.",
        409
      );
    }

    // Find the next eligible term without replacing an existing assignment.

    const {
      nextTerm,
      anchorTerm,
    } = await getNextAssessmentTerm({
      schoolId,
      educationSection,
      transaction,
    });

    const existingAssignment =
      await TermAssessmentConfiguration.findOne({
        where: {
          schoolId,
          termId: nextTerm.id,
          educationSection,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

    if (existingAssignment) {
      throw new AppError(
        "The selected future term already has an assessment configuration. Its assignment will not be overwritten.",
        409
      );
    }

    // Create the next version as PENDING.

    const configuration =
      await AssessmentConfiguration.create(
        {
          schoolId,
          educationSection,
          versionNumber:
            previousConfiguration.versionNumber + 1,
          status: "PENDING",
          previousVersionId: previousConfiguration.id,
          effectiveFromTermId: nextTerm.id,
          effectiveUntilTermId: null,
          createdBy: updatedBy,
        },
        {
          transaction,
        }
      );

    // Store components independently for this version.

    const createdComponents =
      await AssessmentComponent.bulkCreate(
        components.map((component, index) => ({
          assessmentConfigurationId: configuration.id,
          componentName: component.componentName.trim(),
          maximumMark: component.maximumMark,
          weightPercentage: component.weightPercentage,
          displayOrder: index + 1,
        })),
        {
          transaction,
          validate: true,
        }
      );

    // Assign the pending version to its intended future term.

    const termAssignment =
      await TermAssessmentConfiguration.create(
        {
          schoolId,
          termId: nextTerm.id,
          educationSection,
          assessmentConfigurationId: configuration.id,
          assignedBy: updatedBy,
        },
        {
          transaction,
        }
      );

    // Record the last term covered by the previous version.
    // Keep its status ACTIVE until the pending version becomes effective.

    await previousConfiguration.update(
      {
        effectiveUntilTermId: anchorTerm.id,
      },
      {
        transaction,
      }
    );

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message:
        `Assessment Version ${configuration.versionNumber} has been created and assigned to the next eligible term. It is pending until that term becomes effective.`,
      data: {
        configuration,
        components: createdComponents,
        termAssignment,
        previousConfiguration,
        anchorTerm,
        nextTerm,
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    if (error.name === "SequelizeUniqueConstraintError") {
      return next(
        new AppError(
          "An assessment configuration or term assignment already exists for this section.",
          409
        )
      );
    }

    return handleError(error, req, next);
  }
};

// ============================================================
// 4. GET ASSESSMENT CONFIGURATION HISTORY
// ============================================================

export const getAssessmentConfigurationHistory = async (
  req,
  res,
  next
) => {
  try {
    await assertAssessmentReadAccess(req);

    const schoolId = getSchoolId(req);

    const { educationSection } = req.params;

    validateEducationSection(educationSection);

    const configurations =
      await AssessmentConfiguration.findAll({
        where: {
          schoolId,
          educationSection,
        },
        include: [
          {
            model: AssessmentComponent,
            as: "components",
            separate: true,
            order: [
              ["displayOrder", "ASC"],
            ],
          },
          {
            model: Term,
            as: "effectiveFromTerm",
            include: [
              {
                model: Session,
                as: "session",
                attributes: [
                  "id",
                  "sessionName",
                  "status",
                ],
              },
            ],
          },
          {
            model: Term,
            as: "effectiveUntilTerm",
            include: [
              {
                model: Session,
                as: "session",
                attributes: [
                  "id",
                  "sessionName",
                  "status",
                ],
              },
            ],
          },
          {
            model: AssessmentConfiguration,
            as: "previousVersion",
            attributes: [
              "id",
              "versionNumber",
              "status",
            ],
          },
          {
            model: TermAssessmentConfiguration,
            as: "termAssignments",
            separate: true,
            include: [
              {
                model: Term,
                as: "term",
                include: [
                  {
                    model: Session,
                    as: "session",
                    attributes: [
                      "id",
                      "sessionName",
                      "status",
                    ],
                  },
                ],
              },
            ],
            order: [
              ["createdAt", "ASC"],
            ],
          },
        ],
        order: [
          ["versionNumber", "DESC"],
        ],
      });

    return res.status(200).json({
      success: true,
      message:
        "Assessment configuration history retrieved successfully.",
      data: {
        educationSection,
        configurations,
      },
    });
  } catch (error) {
    return handleError(error, req, next);
  }
};
