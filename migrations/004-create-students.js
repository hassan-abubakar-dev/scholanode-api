
import { DataTypes, Sequelize } from "sequelize";

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    // 1. Create the supporting unique index on Classes.
    // PostgreSQL requires the exact referenced column combination
    // to have a unique constraint or unique index.
    await queryInterface.addIndex(
      "Classes",
      ["schoolId", "id"],
      {
        unique: true,
        name: "classes_school_id_id_unique",
        transaction,
      }
    );

    // 2. Create Students table.
    await queryInterface.createTable(
      "Students",
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
          references: {
            model: "Schools",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },

        userId: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        admissionNumber: {
          type: DataTypes.STRING(30),
          allowNull: false,
        },

        gender: {
          type: DataTypes.ENUM("MALE", "FEMALE"),
          allowNull: false,
        },

        dateOfBirth: {
          type: DataTypes.DATEONLY,
          allowNull: true,
        },

        qrToken: {
          type: DataTypes.UUID,
          defaultValue: Sequelize.literal("gen_random_uuid()"),
          allowNull: false,
        },

        currentClassId: {
          type: DataTypes.UUID,
          allowNull: true,
        },

        enrollmentDate: {
          type: DataTypes.DATEONLY,
          allowNull: true,
        },

        admissionStatus: {
          type: DataTypes.ENUM(
            "ACTIVE",
            "GRADUATED",
            "TRANSFERRED",
            "WITHDRAWN"
          ),
          allowNull: false,
          defaultValue: "ACTIVE",
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

    // 3. Admission numbers must be unique within each school.
    await queryInterface.addIndex(
      "Students",
      ["schoolId", "admissionNumber"],
      {
        unique: true,
        name: "students_school_id_admission_number_unique",
        transaction,
      }
    );

    // 4. One user account can have only one student profile.
    await queryInterface.addIndex(
      "Students",
      ["userId"],
      {
        unique: true,
        name: "students_user_id_unique",
        transaction,
      }
    );

    // 5. QR tokens must be globally unique.
    await queryInterface.addIndex(
      "Students",
      ["qrToken"],
      {
        unique: true,
        name: "students_qr_token_unique",
        transaction,
      }
    );

    // 6. Ensure the student account belongs to the same school.
    await queryInterface.sequelize.query(
      `
      ALTER TABLE "Students"
      ADD CONSTRAINT "students_user_same_school_fk"
      FOREIGN KEY ("schoolId", "userId")
      REFERENCES "Users" ("schoolId", "id")
      ON UPDATE CASCADE
      ON DELETE CASCADE;
      `,
      { transaction }
    );

    // 7. Ensure the student's current class belongs to the same school.
    // When a class is deleted, only currentClassId becomes NULL.
    await queryInterface.sequelize.query(
      `
      ALTER TABLE "Students"
      ADD CONSTRAINT "students_class_same_school_fk"
      FOREIGN KEY ("schoolId", "currentClassId")
      REFERENCES "Classes" ("schoolId", "id")
      ON UPDATE CASCADE
      ON DELETE SET NULL ("currentClassId");
      `,
      { transaction }
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
    await queryInterface.dropTable("Students", { transaction });

    await queryInterface.removeIndex(
      "Classes",
      "classes_school_id_id_unique",
      { transaction }
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
