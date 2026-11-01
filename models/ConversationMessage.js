import { DataTypes } from "sequelize";
import { dbConnection } from "../config/db.js";

const ConversationMessage = dbConnection.define(
  "ConversationMessage",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // ===============================
    // CONVERSATION INFORMATION
    // ===============================

    conversationId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    schoolId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // ===============================
    // SENDER INFORMATION
    // ===============================

    // Populated when a school user sends the message.
    senderUserId: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    // Populated when a platform administrator or support agent
    // sends the message.
    senderPlatformUserId: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    // ===============================
    // MESSAGE CONTENT
    // ===============================

    message: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 10000],
      },
    },
  },
  {
    tableName: "ConversationMessages",
    timestamps: true,

    validate: {
      exactlyOneSender() {
        const hasSchoolUser = Boolean(this.senderUserId);
        const hasPlatformUser = Boolean(this.senderPlatformUserId);

        if (hasSchoolUser === hasPlatformUser) {
          throw new Error(
            "A message must have exactly one sender: a school user or a platform user."
          );
        }
      },
    },

    indexes: [
      {
        fields: ["conversationId", "createdAt"],
      },
      {
        fields: ["schoolId", "createdAt"],
      },
      {
        fields: ["senderUserId"],
      },
      {
        fields: ["senderPlatformUserId"],
      },
    ],
  }
);

export default ConversationMessage;