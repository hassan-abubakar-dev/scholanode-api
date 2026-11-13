import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

export async function up({ context: queryInterface }) {
  const transaction = await dbConnection.transaction();

  try {
    await queryInterface.createTable(
      "Complaints",
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

        senderId: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        isAnonymous: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },

        category: {
          type: DataTypes.ENUM(
            "ACADEMIC",
            "STAFF_CONDUCT",
            "STUDENT_WELFARE",
            "FEES_AND_PAYMENTS",
            "FACILITIES",
            "ATTENDANCE",
            "GENERAL"
          ),
          allowNull: false,
        },

        subject: {
          type: DataTypes.STRING(150),
          allowNull: false,
        },

        description: {
          type: DataTypes.TEXT,
          allowNull: false,
        },

        status: {
          type: DataTypes.ENUM(
            "SUBMITTED",
            "IN_PROGRESS",
            "RESOLVED",
            "CLOSED"
          ),
          allowNull: false,
          defaultValue: "SUBMITTED",
        },

        resolutionNote: {
          type: DataTypes.TEXT,
          allowNull: true,
        },

        resolvedAt: {
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

    // School foreign key
    await queryInterface.addConstraint("Complaints", {
      fields: ["schoolId"],
      type: "foreign key",
      name: "complaints_school_id_fkey",
      references: {
        table: "Schools",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
      transaction,
    });

    // Ensure the sender belongs to the same school.
    await queryInterface.addConstraint("Complaints", {
      fields: ["schoolId", "senderId"],
      type: "foreign key",
      name: "complaints_school_sender_fkey",
      references: {
        table: "Users",
        fields: ["schoolId", "id"],
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
      transaction,
    });

    // Indexes matching the Complaint model.
    await queryInterface.addIndex(
      "Complaints",
      ["schoolId", "status", "createdAt"],
      {
        name: "complaints_school_status_created_at_idx",
        transaction,
      }
    );

    await queryInterface.addIndex(
      "Complaints",
      ["schoolId", "senderId", "createdAt"],
      {
        name: "complaints_school_sender_created_at_idx",
        transaction,
      }
    );

    await queryInterface.addIndex(
      "Complaints",
      ["schoolId", "category"],
      {
        name: "complaints_school_category_idx",
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
  await queryInterface.dropTable("Complaints");

  // PostgreSQL creates separate ENUM types for ENUM columns.
  await queryInterface.sequelize.query(
    'DROP TYPE IF EXISTS "enum_Complaints_category";'
  );

  await queryInterface.sequelize.query(
    'DROP TYPE IF EXISTS "enum_Complaints_status";'
  );
}