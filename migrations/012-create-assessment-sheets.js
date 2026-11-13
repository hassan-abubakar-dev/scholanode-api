
import { DataTypes, Sequelize } from "sequelize";

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    // 1. Supporting unique index for the term/configuration relationship.
    await queryInterface.addIndex(
      "TermAssessmentConfigurations",
      ["schoolId", "termId", "assessmentConfigurationId"],
      {
        unique: true,
        name: "term_assessment_school_term_configuration_unique",
        transaction,
      }
    );

    // 2. Create AssessmentSheets table.
    await queryInterface.createTable(
      "AssessmentSheets",
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: Sequelize.literal("gen_random_uuid()"),
          primaryKey: true,
          allowNull: false,
        },

        schoolId: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        termId: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        classId: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        subjectId: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        assessmentConfigurationId: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        teacherId: {
          type: DataTypes.UUID,
          allowNull: true,
        },

        generatedById: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        submittedById: {
          type: DataTypes.UUID,
          allowNull: true,
        },

        status: {
          type: DataTypes.ENUM(
            "NOT_STARTED",
            "DRAFT",
            "SUBMITTED"
          ),
          allowNull: false,
          defaultValue: "NOT_STARTED",
        },

        submittedAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },

        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },

        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
      },
      { transaction }
    );

    // 3. School relationship.
    await queryInterface.addConstraint("AssessmentSheets", {
      fields: ["schoolId"],
      type: "foreign key",
      name: "assessment_sheet_school_fk",
      references: {
        table: "Schools",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
      transaction,
    });

    // 4. Term relationship.
    await queryInterface.addConstraint("AssessmentSheets", {
      fields: ["termId"],
      type: "foreign key",
      name: "assessment_sheet_term_fk",
      references: {
        table: "Terms",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
      transaction,
    });

    // 5. Class must belong to the same school.
    await queryInterface.sequelize.query(`
      ALTER TABLE "AssessmentSheets"
      ADD CONSTRAINT "assessment_sheet_class_same_school_fk"
      FOREIGN KEY ("schoolId", "classId")
      REFERENCES "Classes" ("schoolId", "id")
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
    `, { transaction });

    // 6. Subject must belong to the same school.
    await queryInterface.sequelize.query(`
      ALTER TABLE "AssessmentSheets"
      ADD CONSTRAINT "assessment_sheet_subject_same_school_fk"
      FOREIGN KEY ("schoolId", "subjectId")
      REFERENCES "Subjects" ("schoolId", "id")
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
    `, { transaction });

    // 7. Subject must actually be assigned to the class.
    await queryInterface.sequelize.query(`
      ALTER TABLE "AssessmentSheets"
      ADD CONSTRAINT "assessment_sheet_class_subject_fk"
      FOREIGN KEY ("schoolId", "classId", "subjectId")
      REFERENCES "ClassSubjects" ("schoolId", "classId", "subjectId")
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
    `, { transaction });

    // 8. Configuration must be assigned to this exact term and school.
    await queryInterface.sequelize.query(`
      ALTER TABLE "AssessmentSheets"
      ADD CONSTRAINT "assessment_sheet_term_configuration_fk"
      FOREIGN KEY (
        "schoolId",
        "termId",
        "assessmentConfigurationId"
      )
      REFERENCES "TermAssessmentConfigurations" (
        "schoolId",
        "termId",
        "assessmentConfigurationId"
      )
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
    `, { transaction });

    // 9. Assigned teacher must belong to the same school.
    // Only teacherId becomes NULL when that user is deleted.
    await queryInterface.sequelize.query(`
      ALTER TABLE "AssessmentSheets"
      ADD CONSTRAINT "assessment_sheet_teacher_same_school_fk"
      FOREIGN KEY ("schoolId", "teacherId")
      REFERENCES "Users" ("schoolId", "id")
      ON UPDATE CASCADE
      ON DELETE SET NULL ("teacherId");
    `, { transaction });

    // 10. Generator must belong to the same school.
    await queryInterface.sequelize.query(`
      ALTER TABLE "AssessmentSheets"
      ADD CONSTRAINT "assessment_sheet_generator_same_school_fk"
      FOREIGN KEY ("schoolId", "generatedById")
      REFERENCES "Users" ("schoolId", "id")
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
    `, { transaction });

    // 11. Submitter must belong to the same school.
    // Only submittedById becomes NULL when that user is deleted.
    await queryInterface.sequelize.query(`
      ALTER TABLE "AssessmentSheets"
      ADD CONSTRAINT "assessment_sheet_submitter_same_school_fk"
      FOREIGN KEY ("schoolId", "submittedById")
      REFERENCES "Users" ("schoolId", "id")
      ON UPDATE CASCADE
      ON DELETE SET NULL ("submittedById");
    `, { transaction });

    // 12. Unique assessment sheet per term, class and subject.
    await queryInterface.addIndex(
      "AssessmentSheets",
      ["termId", "classId", "subjectId"],
      {
        unique: true,
        name: "assessment_sheet_term_class_subject_unique",
        transaction,
      }
    );

    // 13. Support class-subject relationship lookups.
    await queryInterface.addIndex(
      "AssessmentSheets",
      ["schoolId", "classId", "subjectId"],
      {
        name: "assessment_sheet_class_subject_index",
        transaction,
      }
    );

    // 14. Support subject relationship lookups.
    await queryInterface.addIndex(
      "AssessmentSheets",
      ["schoolId", "subjectId"],
      {
        name: "assessment_sheet_subject_index",
        transaction,
      }
    );

    // 15. School, term and configuration lookups.
    await queryInterface.addIndex(
      "AssessmentSheets",
      ["schoolId", "termId", "assessmentConfigurationId"],
      {
        name: "assessment_sheet_school_term_configuration",
        transaction,
      }
    );

    // 16. Teacher and status lookups.
    await queryInterface.addIndex(
      "AssessmentSheets",
      ["schoolId", "teacherId", "status"],
      {
        name: "assessment_sheet_teacher_status",
        transaction,
      }
    );

    // 17. Configuration lookups.
    await queryInterface.addIndex(
      "AssessmentSheets",
      ["schoolId", "assessmentConfigurationId"],
      {
        name: "assessment_sheet_configuration",
        transaction,
      }
    );

    // 18. Generator lookups.
    await queryInterface.addIndex(
      "AssessmentSheets",
      ["schoolId", "generatedById"],
      {
        name: "assessment_sheet_generated_by",
        transaction,
      }
    );

    // 19. Submitter lookups.
    await queryInterface.addIndex(
      "AssessmentSheets",
      ["schoolId", "submittedById"],
      {
        name: "assessment_sheet_submitted_by",
        transaction,
      }
    );

    await transaction.commit();

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function down({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    // Drop AssessmentSheets and all its constraints/indexes.
    await queryInterface.dropTable("AssessmentSheets", {
      transaction,
    });

    // Remove the supporting index added to migration 011's table.
    await queryInterface.removeIndex(
      "TermAssessmentConfigurations",
      "term_assessment_school_term_configuration_unique",
      { transaction }
    );

    // Remove the PostgreSQL ENUM type.
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_AssessmentSheets_status";
    `, { transaction });

    await transaction.commit();

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
