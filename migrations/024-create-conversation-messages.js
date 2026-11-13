
import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

export async function up({ context: queryInterface }) {
  const transaction = await dbConnection.transaction();

  try {
    await queryInterface.createTable(
      "ConversationMessages",
      {
        id: {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: dbConnection.literal("gen_random_uuid()"),
        },

        conversationId: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        schoolId: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        senderUserId: {
          type: DataTypes.UUID,
          allowNull: true,
        },

        senderPlatformUserId: {
          type: DataTypes.UUID,
          allowNull: true,
        },

        message: {
          type: DataTypes.TEXT,
          allowNull: false,
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

    // School foreign key.
    await queryInterface.addConstraint("ConversationMessages", {
      fields: ["schoolId"],
      type: "foreign key",
      name: "conversation_messages_school_id_fkey",
      references: {
        table: "Schools",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
      transaction,
    });

    // Ensure the conversation belongs to the same school.
    await queryInterface.addConstraint("ConversationMessages", {
      fields: ["schoolId", "conversationId"],
      type: "foreign key",
      name: "conversation_messages_school_conversation_fkey",
      references: {
        table: "SupportConversations",
        fields: ["schoolId", "id"],
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
      transaction,
    });

    // Ensure a school-user sender belongs to the same school.
    await queryInterface.addConstraint("ConversationMessages", {
      fields: ["schoolId", "senderUserId"],
      type: "foreign key",
      name: "conversation_messages_school_sender_user_fkey",
      references: {
        table: "Users",
        fields: ["schoolId", "id"],
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
      transaction,
    });

    // Platform administrator or support-agent sender.
    await queryInterface.addConstraint("ConversationMessages", {
      fields: ["senderPlatformUserId"],
      type: "foreign key",
      name: "conversation_messages_platform_sender_fkey",
      references: {
        table: "PlatformUsers",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
      transaction,
    });

    // Exactly one sender must be provided.
    await queryInterface.sequelize.query(
      `
        ALTER TABLE "ConversationMessages"
        ADD CONSTRAINT "conversation_messages_exactly_one_sender_check"
        CHECK (
          (
            "senderUserId" IS NOT NULL
            AND "senderPlatformUserId" IS NULL
          )
          OR
          (
            "senderUserId" IS NULL
            AND "senderPlatformUserId" IS NOT NULL
          )
        );
      `,
      { transaction }
    );

    // Indexes matching the ConversationMessage model.
    await queryInterface.addIndex(
      "ConversationMessages",
      ["conversationId", "createdAt"],
      {
        name: "conversation_messages_conversation_created_at_idx",
        transaction,
      }
    );

    await queryInterface.addIndex(
      "ConversationMessages",
      ["schoolId", "createdAt"],
      {
        name: "conversation_messages_school_created_at_idx",
        transaction,
      }
    );

    await queryInterface.addIndex(
      "ConversationMessages",
      ["senderUserId"],
      {
        name: "conversation_messages_sender_user_idx",
        transaction,
      }
    );

    await queryInterface.addIndex(
      "ConversationMessages",
      ["senderPlatformUserId"],
      {
        name: "conversation_messages_platform_sender_idx",
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
      "ConversationMessages",
      { transaction }
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
