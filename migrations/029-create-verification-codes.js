import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

export async function up({ context: queryInterface }) {
  const transaction = await dbConnection.transaction();

  try {
    // =====================================
    // CREATE TABLE
    // =====================================

    await queryInterface.createTable(
      "verificationCodes",
      {
        // Sequelize's automatically generated integer ID
        id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },

        code: {
          type: DataTypes.STRING(6),
          allowNull: false,
        },

        expiry_time: {
          type: DataTypes.BIGINT,
          allowNull: false,
        },

        user_email: {
          type: DataTypes.STRING(100),
          allowNull: false,
        },

        user_id: {
          type: DataTypes.UUID,
          allowNull: true,
        },

        purpose: {
          type: DataTypes.ENUM(
            "PASSWORD_RESET",
            "PROFILE_EMAIL_CHANGE",
            "SCHOOL_REGISTRATION"
          ),
          allowNull: false,
          defaultValue: "PASSWORD_RESET",
        },

        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: dbConnection.literal("CURRENT_TIMESTAMP"),
        },

        updated_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: dbConnection.literal("CURRENT_TIMESTAMP"),
        },
      },
      { transaction }
    );

    // =====================================
    // FOREIGN KEY
    // =====================================

    await queryInterface.addConstraint(
      "verificationCodes",
      {
        fields: ["user_id"],
        type: "foreign key",
        name: "verification_codes_user_id_fkey",

        references: {
          table: "Users",
          field: "id",
        },

        onUpdate: "CASCADE",
        onDelete: "SET NULL",

        transaction,
      }
    );

    // =====================================
    // PARTIAL UNIQUE INDEXES
    // =====================================

    // A user can have only one code per purpose.
    // Applies only when user_id is NOT NULL.

    await queryInterface.sequelize.query(
      `
      CREATE UNIQUE INDEX "verification_codes_user_purpose_unique"
      ON "verificationCodes" ("user_id", "purpose")
      WHERE "user_id" IS NOT NULL;
      `,
      { transaction }
    );

    // Legacy records without user_id:
    // One code per email and purpose.

    await queryInterface.sequelize.query(
      `
      CREATE UNIQUE INDEX "verification_codes_email_purpose_unique"
      ON "verificationCodes" ("user_email", "purpose")
      WHERE "user_id" IS NULL;
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
  const transaction = await dbConnection.transaction();

  try {
    await queryInterface.dropTable(
      "verificationCodes",
      { transaction }
    );

    await queryInterface.sequelize.query(
      `
      DROP TYPE IF EXISTS "enum_verificationCodes_purpose";
      `,
      { transaction }
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}