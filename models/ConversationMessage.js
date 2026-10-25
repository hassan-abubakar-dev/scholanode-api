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
      allowNull: true,
      validate: {
        len: [1, 10000],
      },
    },

    // ===============================
    // OPTIONAL IMAGE ATTACHMENT
    // ===============================

    imageUrl: {
      type: DataTypes.STRING(2048),
      allowNull: true,
    },

    // Cloudflare R2 object key.
    imageKey: {
      type: DataTypes.STRING(500),
      allowNull: true,
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

      messageOrImageRequired() {
        const hasMessage =
          typeof this.message === "string" &&
          this.message.trim().length > 0;

        const hasImage =
          typeof this.imageUrl === "string" &&
          this.imageUrl.trim().length > 0;

        if (!hasMessage && !hasImage) {
          throw new Error(
            "A message or image attachment is required."
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