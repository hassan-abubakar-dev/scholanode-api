
import { DataTypes, Sequelize } from "sequelize";

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    // Required for PostgreSQL GiST exclusion constraints
    await queryInterface.sequelize.query(
      `CREATE EXTENSION IF NOT EXISTS btree_gist;`,
      { transaction }
    );

    // Create Classes table
    await queryInterface.createTable(
      "Classes",
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

        classLevel: {
          type: DataTypes.STRING(20),
          allowNull: false,
        },

        arm: {
          type: DataTypes.STRING(50),
          allowNull: true,
        },

        educationSection: {
          type: DataTypes.ENUM(
            "EARLY_YEARS",
            "PRIMARY",
            "JUNIOR_SECONDARY",
            "SENIOR_SECONDARY"
          ),
          allowNull: false,
          defaultValue: "PRIMARY",
        },

        formMasterId: {
          type: DataTypes.UUID,
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

    // Only one unarmed class per school and class level
    await queryInterface.sequelize.query(
      `
        CREATE UNIQUE INDEX "classes_unarmed_unique"
        ON "Classes" ("schoolId", "classLevel")
        WHERE "arm" IS NULL;
      `,
      { transaction }
    );

    // Each arm must be unique within its school and class level
    await queryInterface.sequelize.query(
      `
        CREATE UNIQUE INDEX "classes_armed_unique"
        ON "Classes" ("schoolId", "classLevel", "arm")
        WHERE "arm" IS NOT NULL;
      `,
      { transaction }
    );

    // Ensure the form master belongs to the same school
    // Deleting the user only clears formMasterId.
    await queryInterface.sequelize.query(
      `
        ALTER TABLE "Classes"
        ADD CONSTRAINT "classes_form_master_same_school_fk"
        FOREIGN KEY ("schoolId", "formMasterId")
        REFERENCES "Users" ("schoolId", "id")
        ON UPDATE CASCADE
        ON DELETE SET NULL ("formMasterId");
      `,
      { transaction }
    );

    // Prevent mixing unarmed and armed classes
    await queryInterface.sequelize.query(
      `
        ALTER TABLE "Classes"
        ADD CONSTRAINT "classes_arm_mode_exclusion"
        EXCLUDE USING gist (
          "schoolId" WITH =,
          "classLevel" WITH =,
          (("arm" IS NULL)) WITH <>
        );
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
  await queryInterface.dropTable("Classes");
}
