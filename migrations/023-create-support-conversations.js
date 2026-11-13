
import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

export async function up({ context: queryInterface }) {
  const transaction = await dbConnection.transaction();

  try {
    await queryInterface.createTable(
      "SupportConversations",
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

        createdByUserId: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        category: {
          type: DataTypes.ENUM(
            "TECHNICAL_ISSUE",
            "ACCOUNT_AND_ACCESS",
            "BILLING_AND_PAYMENT",
            "BUG_REPORT",
            "FEATURE_REQUEST",
            "GENERAL_INQUIRY",
            "OTHER"
          ),
          allowNull: false,
        },

        status: {
          type: DataTypes.ENUM(
            "OPEN",
            "IN_PROGRESS",
            "RESOLVED",
            "CLOSED"
          ),
          allowNull: false,
          defaultValue: "OPEN",
        },

        isEscalated: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },

        currentHandlerId: {
          type: DataTypes.UUID,
          allowNull: true,
        },

        escalatedBy: {
          type: DataTypes.UUID,
          allowNull: true,
        },

        escalatedAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },

        escalationReason: {
          type: DataTypes.TEXT,
          allowNull: true,
        },

        resolvedAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },

        closedAt: {
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

    // Supporting unique index for same-school conversation references.
    await queryInterface.addIndex(
      "SupportConversations",
      ["schoolId", "id"],
      {
        unique: true,
        name: "support_conversations_school_id_id_unique",
        transaction,
      }
    );

    // School foreign key.
    await queryInterface.addConstraint("SupportConversations", {
      fields: ["schoolId"],
      type: "foreign key",
      name: "support_conversations_school_id_fkey",
      references: {
        table: "Schools",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
      transaction,
    });

    // Ensure the conversation creator belongs to the same school.
    await queryInterface.addConstraint("SupportConversations", {
      fields: ["schoolId", "createdByUserId"],
      type: "foreign key",
      name: "support_conversations_school_creator_fkey",
      references: {
        table: "Users",
        fields: ["schoolId", "id"],
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
      transaction,
    });

    // Current platform support handler.
    await queryInterface.addConstraint("SupportConversations", {
      fields: ["currentHandlerId"],
      type: "foreign key",
      name: "support_conversations_current_handler_fkey",
      references: {
        table: "PlatformUsers",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
      transaction,
    });

    // Platform user who escalated the conversation.
    await queryInterface.addConstraint("SupportConversations", {
      fields: ["escalatedBy"],
      type: "foreign key",
      name: "support_conversations_escalated_by_fkey",
      references: {
        table: "PlatformUsers",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
      transaction,
    });

    // Indexes matching the SupportConversation model.
    await queryInterface.addIndex(
      "SupportConversations",
      ["schoolId", "status", "createdAt"],
      {
        name: "support_conversations_school_status_created_at_idx",
        transaction,
      }
    );

    await queryInterface.addIndex(
      "SupportConversations",
      ["schoolId", "createdByUserId", "createdAt"],
      {
        name: "support_conversations_school_creator_created_at_idx",
        transaction,
      }
    );

    await queryInterface.addIndex(
      "SupportConversations",
      ["schoolId", "category"],
      {
        name: "support_conversations_school_category_idx",
        transaction,
      }
    );

    await queryInterface.addIndex(
      "SupportConversations",
      ["status", "isEscalated", "createdAt"],
      {
        name: "support_conversations_status_escalated_created_at_idx",
        transaction,
      }
    );

    await queryInterface.addIndex(
      "SupportConversations",
      ["currentHandlerId", "status"],
      {
        name: "support_conversations_handler_status_idx",
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
      "SupportConversations",
      { transaction }
    );

    // PostgreSQL creates separate ENUM types for ENUM columns.
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_SupportConversations_category";',
      { transaction }
    );

    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_SupportConversations_status";',
      { transaction }
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
