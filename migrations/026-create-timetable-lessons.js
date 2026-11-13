
import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

export async function up({ context: queryInterface }) {
  const transaction = await dbConnection.transaction();

  try {
    await queryInterface.createTable(
      "TimetableLessons",
      {
        id: {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: dbConnection.literal("gen_random_uuid()"),
        },

        schoolId: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        classId: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        periodId: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        dayOfWeek: {
          type: DataTypes.ENUM(
            "MONDAY",
            "TUESDAY",
            "WEDNESDAY",
            "THURSDAY",
            "FRIDAY",
            "SATURDAY",
            "SUNDAY"
          ),
          allowNull: false,
        },

        subjectId: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        teacherId: {
          type: DataTypes.UUID,
          allowNull: true,
        },

        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: dbConnection.literal("CURRENT_TIMESTAMP"),
        },

        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: dbConnection.literal("CURRENT_TIMESTAMP"),
        },
      },
      { transaction }
    );

    // School foreign key
    await queryInterface.addConstraint("TimetableLessons", {
      fields: ["schoolId"],
      type: "foreign key",
      name: "timetable_lessons_school_id_fkey",
      references: {
        table: "Schools",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
      transaction,
    });

    // Class foreign key: ensures the class belongs to the same school
    await queryInterface.addConstraint("TimetableLessons", {
      fields: ["schoolId", "classId"],
      type: "foreign key",
      name: "timetable_lessons_school_class_fkey",
      references: {
        table: "Classes",
        fields: ["schoolId", "id"],
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
      transaction,
    });

    // Period foreign key: ensures the period belongs to the same school
    await queryInterface.addConstraint("TimetableLessons", {
      fields: ["schoolId", "periodId"],
      type: "foreign key",
      name: "timetable_lessons_school_period_fkey",
      references: {
        table: "TimetablePeriods",
        fields: ["schoolId", "id"],
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
      transaction,
    });

    // Subject foreign key: ensures the subject belongs to the same school
    await queryInterface.addConstraint("TimetableLessons", {
      fields: ["schoolId", "subjectId"],
      type: "foreign key",
      name: "timetable_lessons_school_subject_fkey",
      references: {
        table: "Subjects",
        fields: ["schoolId", "id"],
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
      transaction,
    });

    // Teacher foreign key.
    // Only teacherId should become NULL when a teacher is deleted.
    // schoolId must remain unchanged.
    await queryInterface.sequelize.query(
      `
        ALTER TABLE "TimetableLessons"
        ADD CONSTRAINT "timetable_lessons_school_teacher_fkey"
        FOREIGN KEY ("schoolId", "teacherId")
        REFERENCES "Users" ("schoolId", "id")
        ON UPDATE CASCADE
        ON DELETE SET NULL ("teacherId");
      `,
      { transaction }
    );

    // Prevent duplicate lesson slots for the same class
    await queryInterface.addIndex(
      "TimetableLessons",
      ["schoolId", "classId", "periodId", "dayOfWeek"],
      {
        unique: true,
        name: "unique_timetable_lesson_slot",
        transaction,
      }
    );

    // Class timetable lookup
    await queryInterface.addIndex(
      "TimetableLessons",
      ["schoolId", "classId"],
      {
        name: "idx_timetable_lesson_school_class",
        transaction,
      }
    );

    // Teacher timetable lookup
    await queryInterface.addIndex(
      "TimetableLessons",
      ["schoolId", "teacherId", "dayOfWeek"],
      {
        name: "idx_timetable_lesson_teacher_day",
        transaction,
      }
    );

    // Prevent a teacher from being assigned to two classes
    // in the same period on the same day
    await queryInterface.addIndex(
      "TimetableLessons",
      ["schoolId", "teacherId", "dayOfWeek", "periodId"],
      {
        unique: true,
        name: "unique_timetable_teacher_period",
        transaction,
      }
    );

    // Subject timetable lookup
    await queryInterface.addIndex(
      "TimetableLessons",
      ["schoolId", "subjectId"],
      {
        name: "idx_timetable_lesson_school_subject",
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
  const transaction = await dbConnection.transaction();

  try {
    await queryInterface.dropTable(
      "TimetableLessons",
      { transaction }
    );

    // Remove the PostgreSQL ENUM type after dropping its table
    await queryInterface.sequelize.query(
      `
        DROP TYPE IF EXISTS "enum_TimetableLessons_dayOfWeek";
      `,
      { transaction }
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
