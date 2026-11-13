import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

export async function up({ context: queryInterface }) {
  const transaction = await dbConnection.transaction();

  try {
    await queryInterface.createTable(
      "PlatformUsers",
      {
        id: {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: dbConnection.literal("gen_random_uuid()"),
        },

        firstName: {
          type: DataTypes.STRING(50),
          allowNull: false,
        },

        surName: {
          type: DataTypes.STRING(50),
          allowNull: false,
        },

        email: {
          type: DataTypes.STRING(100),
          allowNull: false,
        },

        passwordHash: {
          type: DataTypes.STRING,
          allowNull: false,
        },

        role: {
          type: DataTypes.ENUM(
            "PLATFORM_ADMIN",
            "SUPPORT_AGENT"
          ),
          allowNull: false,
        },

        phoneNumber: {
          type: DataTypes.STRING(20),
          allowNull: true,
        },

        profileImageUrl: {
          type: DataTypes.STRING,
          allowNull: true,
        },

        profileImagePublicId: {
          type: DataTypes.STRING,
          allowNull: true,
        },

        status: {
          type: DataTypes.ENUM(
            "ACTIVE",
            "INACTIVE",
            "SUSPENDED"
          ),
          allowNull: false,
          defaultValue: "ACTIVE",
        },

        mustChangePassword: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },

        lastLoginAt: {
          type: DataTypes.DATE,
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

    // Unique email constraint
    await queryInterface.addConstraint("PlatformUsers", {
      fields: ["email"],
      type: "unique",
      name: "platform_users_email_unique",
      transaction,
    });

    // Index for filtering platform users by role and status.
    await queryInterface.addIndex(
      "PlatformUsers",
      ["role", "status"],
      {
        name: "platform_users_role_status_idx",
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
  await queryInterface.dropTable("PlatformUsers");

  // PostgreSQL creates separate ENUM types for ENUM columns.
  await queryInterface.sequelize.query(
    'DROP TYPE IF EXISTS "enum_PlatformUsers_role";'
  );

  await queryInterface.sequelize.query(
    'DROP TYPE IF EXISTS "enum_PlatformUsers_status";'
  );
}