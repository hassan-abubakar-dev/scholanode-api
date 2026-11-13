
import { DataTypes, Sequelize } from "sequelize";

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    // 1. Supporting unique index for Students(schoolId, id).
    await queryInterface.addIndex(
      "Students",
      ["schoolId", "id"],
      {
        unique: true,
        name: "students_school_id_id_unique",
        transaction,
      }
    );

    // 2. Supporting unique index for AssessmentSheets(schoolId, id).
    await queryInterface.addIndex(
      "AssessmentSheets",
      ["schoolId", "id"],
      {
        unique: true,
        name: "assessment_sheet_school_id_id_unique",
        transaction,
      }
    );

    // 3. Create AssessmentScores table.
    await queryInterface.createTable(
      "AssessmentScores",
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

        assessmentSheetId: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        studentId: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        assessmentComponentId: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        score: {
          type: DataTypes.DECIMAL(8, 2),
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

    // 4. Assessment sheet relationship.
    // A sheet cannot be deleted independently while scores
    // reference it; deleting the sheet removes its scores.
    await queryInterface.sequelize.query(`
      ALTER TABLE "AssessmentScores"
      ADD CONSTRAINT "assessment_score_sheet_same_school_fk"
      FOREIGN KEY ("schoolId", "assessmentSheetId")
      REFERENCES "AssessmentSheets" ("schoolId", "id")
      ON UPDATE CASCADE
      ON DELETE CASCADE;
    `, { transaction });

    // 5. Student relationship.
    // Protect historical academic scores from student deletion.
    await queryInterface.sequelize.query(`
      ALTER TABLE "AssessmentScores"
      ADD CONSTRAINT "assessment_score_student_same_school_fk"
      FOREIGN KEY ("schoolId", "studentId")
      REFERENCES "Students" ("schoolId", "id")
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
    `, { transaction });

    // 6. Assessment component relationship.
    // Components referenced by scores cannot be deleted.
    await queryInterface.addConstraint("AssessmentScores", {
      fields: ["assessmentComponentId"],
      type: "foreign key",
      name: "assessment_score_component_fk",
      references: {
        table: "AssessmentComponents",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
      transaction,
    });

    // 7. Prevent negative scores.
    // NULL is allowed because marks may not have been entered yet.
    await queryInterface.sequelize.query(`
      ALTER TABLE "AssessmentScores"
      ADD CONSTRAINT "assessment_score_non_negative_check"
      CHECK ("score" IS NULL OR "score" >= 0);
    `, { transaction });

    // 8. Prevent duplicate scores for the same
    // sheet, student and component.
    await queryInterface.addIndex(
      "AssessmentScores",
      [
        "assessmentSheetId",
        "studentId",
        "assessmentComponentId",
      ],
      {
        unique: true,
        name: "assessment_score_sheet_student_component_unique",
        transaction,
      }
    );

    // 9. School and assessment sheet lookup.
    await queryInterface.addIndex(
      "AssessmentScores",
      ["schoolId", "assessmentSheetId"],
      {
        name: "assessment_score_school_sheet",
        transaction,
      }
    );

    // 10. Student lookup.
    await queryInterface.addIndex(
      "AssessmentScores",
      ["schoolId", "studentId"],
      {
        name: "assessment_score_student",
        transaction,
      }
    );

    // 11. Component lookup.
    await queryInterface.addIndex(
      "AssessmentScores",
      ["assessmentComponentId"],
      {
        name: "assessment_score_component",
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
    // Drop the scores table and its constraints/indexes.
    await queryInterface.dropTable(
      "AssessmentScores",
      { transaction }
    );

    // Remove supporting indexes created by this migration.
    await queryInterface.removeIndex(
      "AssessmentSheets",
      "assessment_sheet_school_id_id_unique",
      { transaction }
    );

    await queryInterface.removeIndex(
      "Students",
      "students_school_id_id_unique",
      { transaction }
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
