import { handleControllerError } from "../utils/controllerError.js";
import { Owner, SupportConversation, ConversationMessage } from "../relationships/associations.js";
import { Op } from "sequelize";
import { dbConnection } from "../config/db.js";

import AppError from "../utils/AppError.js";
import { serializeStaffProfile } from "../utils/pendingProfile.js";

// ==========================================
// CONSTANTS
// ==========================================

const supportRoles = [
  "LEADER",
  "VICE_LEADER",
  "ADMINISTRATOR",
  "EXAM_OFFICER",
];

// ==========================================
// HELPERS
// ==========================================

// Ensure the user belongs to a school.
const getSchoolId = (req, next) => {
  if (!req.user?.schoolId) {
    next(
      new AppError(
        "Your account is not associated with a school.",
        403
      )
    );

    return null;
  }

  return req.user.schoolId;
};

// ==========================================
// SUPPORT AUTHORIZATION
// ==========================================

// Allows authorized administrators and school owners.
// Owners are identified through the Owners table.

export const authorizeSupportAccess = async (
  req,
  res,
  next
) => {
  try {
    if (!req.user?.schoolId) {
      return next(
        new AppError(
          "Your account is not associated with a school.",
          403
        )
      );
    }

    // Regular school administrators.
    if (supportRoles.includes(req.user.role)) {
      return next();
    }

    // Check whether the authenticated user owns this school.
    const owner = await Owner.findOne({
      where: {
        userId: req.user.id,
        schoolId: req.user.schoolId,
      },
    });

    if (!owner) {
      return next(
        new AppError(
          "You are not authorized to access Help & Support.",
          403
        )
      );
    }

    return next();
  } catch (error) {
    return handleControllerError(error, next, req, "SUPPORT_CONTROLLER_ERROR", "Unable to process this request. Please try again.");
  }
};

// ==========================================
// FIND MY CONVERSATION
// ==========================================

// Every school-facing conversation lookup must verify:
// 1. Conversation ID.
// 2. School ID.
// 3. Initiating user ID.

const findMyConversation = async (
  conversationId,
  schoolId,
  userId
) => {
  return SupportConversation.findOne({
    where: {
      id: conversationId,
      schoolId,
      createdByUserId: userId,
    },
  });
};

// ==========================================
// 1. CREATE CONVERSATION
// ==========================================

export const createConversation = async (
  req,
  res,
  next
) => {
  const transaction = await dbConnection.transaction();

  try {
    const schoolId = getSchoolId(req, next);

    if (!schoolId) {
      await transaction.rollback();
      return;
    }

    const {
      category,
      message,
    } = req.body;

    // Create the conversation.
    const conversation = await SupportConversation.create(
      {
        schoolId,
        createdByUserId: req.user.id,
        category,
        status: "OPEN",
      },
      { transaction }
    );

    // Create the initial message.
    const initialMessage = await ConversationMessage.create(
      {
        conversationId: conversation.id,
        schoolId,
        senderUserId: req.user.id,
        senderPlatformUserId: null,
        message,
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Support conversation created successfully.",
      data: {
        conversation,
        message: initialMessage,
      },
    });
  } catch (error) {
    await transaction.rollback();
    return handleControllerError(error, next, req, "SUPPORT_CONTROLLER_ERROR", "Unable to process this request. Please try again.");
  }
};

// ==========================================
// 2. GET MY CONVERSATIONS
// ==========================================

export const getMyConversations = async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req, next);

    if (!schoolId) return;

    const {
      status,
      category,
      page: queryPage = 1,
      limit: queryLimit = 20,
    } = req.query;

    const page = Number(queryPage);
    const limit = Number(queryLimit);
    const offset = (page - 1) * limit;

    const where = {
      schoolId,
      createdByUserId: req.user.id,
    };

    if (status) where.status = status;
    if (category) where.category = category;

    const { count, rows } =
      await SupportConversation.findAndCountAll({
        where,
        order: [["updatedAt", "DESC"]],
        limit,
        offset,
      });

    return res.status(200).json({
      success: true,
      message: "Your support conversations retrieved successfully.",
      data: {
        conversations: rows,
        pagination: {
          totalItems: count,
          currentPage: page,
          pageSize: limit,
          totalPages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    return handleControllerError(error, next, req, "SUPPORT_CONTROLLER_ERROR", "Unable to process this request. Please try again.");
  }
};

// ==========================================
// 3. GET CONVERSATION MESSAGES
// ==========================================

export const getConversationMessages = async (
  req,
  res,
  next
) => {
  try {
    const schoolId = getSchoolId(req, next);

    if (!schoolId) return;

    const { conversationId } = req.params;

    const {
      page: queryPage = 1,
      limit: queryLimit = 50,
    } = req.query;

    const page = Number(queryPage);
    const limit = Number(queryLimit);

    // Verify conversation ownership.
    const conversation = await findMyConversation(
      conversationId,
      schoolId,
      req.user.id
    );

    if (!conversation) {
      return next(
        new AppError(
          "Support conversation not found.",
          404
        )
      );
    }

    const offset = (page - 1) * limit;

    const {
      count,
      rows,
    } = await ConversationMessage.findAndCountAll({
      where: {
        conversationId,
        schoolId,
      },

      include: [
        {
          association: "senderUser",
          attributes: [
            "id",
            "firstName",
            "surName",
            "email",
            "role",
          ],
          required: false,
        },
        {
          association: "senderPlatformUser",
          attributes: ["id"],
          required: false,
        },
      ],

      // Retrieve the latest messages first,
      // then reverse them for chronological display.
      order: [["createdAt", "DESC"]],

      limit,
      offset,
      distinct: true,
    });

    const messages = rows
      .reverse()
      .map((record) => {
        const message = record.toJSON();

        return message.senderUser
          ? {
              ...message,
              senderUser: serializeStaffProfile(message.senderUser),
            }
          : message;
      });

    return res.status(200).json({
      success: true,
      message: "Conversation messages retrieved successfully.",
      data: {
        conversation,
        messages,
        pagination: {
          totalItems: count,
          currentPage: page,
          pageSize: limit,
          totalPages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    return handleControllerError(error, next, req, "SUPPORT_CONTROLLER_ERROR", "Unable to process this request. Please try again.");
  }
};

// ==========================================
// 4. SEND MESSAGE
// ==========================================

export const sendMessage = async (
  req,
  res,
  next
) => {
  const transaction = await dbConnection.transaction();

  try {
    const schoolId = getSchoolId(req, next);

    if (!schoolId) {
      await transaction.rollback();
      return;
    }

    const { conversationId } = req.params;
    const { message } = req.body;

    // Verify conversation ownership.
    const conversation = await findMyConversation(
      conversationId,
      schoolId,
      req.user.id
    );

    if (!conversation) {
      await transaction.rollback();

      return next(
        new AppError(
          "Support conversation not found.",
          404
        )
      );
    }

    // Resolved or closed conversations cannot receive
    // messages until the school user reopens them.
    if (
      ["RESOLVED", "CLOSED"].includes(conversation.status)
    ) {
      await transaction.rollback();

      return next(
        new AppError(
          "This conversation is no longer active. Reopen it before sending another message.",
          400
        )
      );
    }

    const newMessage = await ConversationMessage.create(
      {
        conversationId,
        schoolId,
        senderUserId: req.user.id,
        senderPlatformUserId: null,
        message,
      },
      { transaction }
    );

    // Update conversation activity so it appears
    // at the top of the conversation list.
    await conversation.update(
      {
        updatedAt: new Date(),
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Message sent successfully.",
      data: {
        message: newMessage,
      },
    });
  } catch (error) {
    await transaction.rollback();
    return handleControllerError(error, next, req, "SUPPORT_CONTROLLER_ERROR", "Unable to process this request. Please try again.");
  }
};

// ==========================================
// 5. REOPEN CONVERSATION
// ==========================================

export const reopenConversation = async (
  req,
  res,
  next
) => {
  try {
    const schoolId = getSchoolId(req, next);

    if (!schoolId) return;

    const { conversationId } = req.params;

    const conversation = await findMyConversation(
      conversationId,
      schoolId,
      req.user.id
    );

    if (!conversation) {
      return next(
        new AppError(
          "Support conversation not found.",
          404
        )
      );
    }

    // Only resolved conversations can be reopened.
    if (conversation.status !== "RESOLVED") {
      return next(
        new AppError(
          "Only resolved conversations can be reopened.",
          400
        )
      );
    }

    conversation.status = "OPEN";
    conversation.resolvedAt = null;

    await conversation.save();

    return res.status(200).json({
      success: true,
      message: "Support conversation reopened successfully.",
      data: {
        conversation,
      },
    });
  } catch (error) {
    return handleControllerError(error, next, req, "SUPPORT_CONTROLLER_ERROR", "Unable to process this request. Please try again.");
  }
};