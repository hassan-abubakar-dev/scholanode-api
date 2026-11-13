
import { DataTypes, Sequelize } from "sequelize";

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    await queryInterface.createTable(
      "ParentStudents",
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

        parentId: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        studentId: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        relationship: {
          type: DataTypes.ENUM(
            "FATHER",
            "MOTHER",
            "GUARDIAN",
            "OTHER"
          ),
          allowNull: false,
        },

        receivesNotifications: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
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

    // ParentStudent must belong to an existing school.
    await queryInterface.addConstraint("ParentStudents", {
      fields: ["schoolId"],
      type: "foreign key",
      name: "parent_student_school_fk",
      references: {
        table: "Schools",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
      transaction,
    });

    // Parent must belong to the same school.
    await queryInterface.sequelize.query(`
      ALTER TABLE "ParentStudents"
      ADD CONSTRAINT "parent_student_parent_same_school_fk"
      FOREIGN KEY ("schoolId", "parentId")
      REFERENCES "Parents" ("schoolId", "id")
      ON UPDATE CASCADE
      ON DELETE CASCADE;
    `, { transaction });

    // Student must belong to the same school.
    await queryInterface.sequelize.query(`
      ALTER TABLE "ParentStudents"
      ADD CONSTRAINT "parent_student_student_same_school_fk"
      FOREIGN KEY ("schoolId", "studentId")
      REFERENCES "Students" ("schoolId", "id")
      ON UPDATE CASCADE
      ON DELETE CASCADE;
    `, { transaction });

    // Prevent duplicate parent-student relationships.
    await queryInterface.addIndex(
      "ParentStudents",
      ["schoolId", "parentId", "studentId"],
      {
        unique: true,
        name: "parent_student_unique",
        transaction,
      }
    );

    // Support looking up all parents linked to a student.
    await queryInterface.addIndex(
      "ParentStudents",
      ["schoolId", "studentId"],
      {
        name: "parent_student_student_index",
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
  await queryInterface.dropTable("ParentStudents");

  await queryInterface.sequelize.query(`
    DROP TYPE IF EXISTS "enum_ParentStudents_relationship";
  `);
}
