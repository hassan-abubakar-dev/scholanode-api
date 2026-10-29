
import {
  SupportConversation,
  ConversationMessage,
} from "../relationships/associations.js";

import { dbConnection } from "../config/db.js";
import AppError from "../utils/AppError.js";
import { Op } from "sequelize";

// ==========================================
// CONFIGURATION
// ==========================================

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_MESSAGE_LENGTH = 10000;

const CLOSED_STATUSES = ["RESOLVED", "CLOSED"];

// Adjust this list if your application uses a different authorization policy.
const SUPPORT_ALLOWED_ROLES = [
  "OWNER",
  "LEADER",
  "ADMINISTRATOR",
];

// ==========================================
// HELPERS
// ==========================================

const getSchoolUser = (req) => {
  const userId = req.user?.id;
  const schoolId = req.user?.schoolId;

  if (!userId || !schoolId) {
    throw new AppError(
      "Authenticated school user information is missing.",
      401
    );
  }

  return { userId, schoolId };
};

const hasSupportAccess = (req) => {
  const role = req.user?.role;
  const roles = Array.isArray(req.user?.roles)
    ? req.user.roles
    : [];

  const assignedRoles = [
    ...(role ? [role] : []),
    ...roles,
  ];

  return assignedRoles.some((assignedRole) =>
    SUPPORT_ALLOWED_ROLES.includes(assignedRole)
  );
};

const requireSupportAccess = (req) => {
  if (!hasSupportAccess(req)) {
    throw new AppError(
      "You are not authorized to access Help & Support.",
      403
    );
  }
};

const getPagination = (query, defaultLimit = DEFAULT_PAGE_SIZE) => {
  const parsedPage = Number(query.page ?? 1);
  const parsedLimit = Number(query.limit ?? defaultLimit);

  const page = Number.isInteger(parsedPage) && parsedPage > 0
    ? parsedPage
    : 1;

  const limit =
    Number.isInteger(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, MAX_PAGE_SIZE)
      : defaultLimit;

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
};

const getMessageContent = (body) => {
  const message =
    typeof body.message === "string" && body.message.trim()
      ? body.message.trim()
      : null;

  const imageUrl =
    typeof body.imageUrl === "string" && body.imageUrl.trim()
      ? body.imageUrl.trim()
      : null;

  const imageKey =
    typeof body.imageKey === "string" && body.imageKey.trim()
      ? body.imageKey.trim()
      : null;

  if (!message && !imageUrl) {
    throw new AppError(
      "Please provide a message or an image attachment.",
      400
    );
  }

  if (message && message.length > MAX_MESSAGE_LENGTH) {
    throw new AppError(
      `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters.`,
      400
    );
  }

  // An image key without a URL, or a URL without a key, is rejected.
  if (Boolean(imageUrl) !== Boolean(imageKey)) {
    throw new AppError(
      "The image attachment is invalid. Please upload it again.",
      400
    );
  }

  return { message, imageUrl, imageKey };
};

const findMyConversation = async ({
  conversationId,
  schoolId,
  userId,
  transaction,
  lock,
}) => {
  const conversation = await SupportConversation.findOne({
    where: {
      id: conversationId,
      schoolId,
      createdByUserId: userId,
    },
    transaction,
    ...(lock && transaction
      ? { lock: transaction.LOCK.UPDATE }
      : {}),
  });

  if (!conversation) {
    throw new AppError("Support conversation not found.", 404);
  }

  return conversation;
};

const rollbackIfNeeded = async (transaction) => {
  if (transaction && !transaction.finished) {
    await transaction.rollback();
  }
};

// ==========================================
// 1. CREATE CONVERSATION
// ==========================================

export const createConversation = async (req, res, next) => {
  let transaction;

  try {
    requireSupportAccess(req);

    const { userId, schoolId } = getSchoolUser(req);
    const { category } = req.body;
    const { message, imageUrl, imageKey } =
      getMessageContent(req.body);

    transaction = await dbConnection.transaction();

    const conversation = await SupportConversation.create(
      {
        schoolId,
        createdByUserId: userId,
        category,
        status: "OPEN",
        isEscalated: false,
        currentHandlerId: null,
      },
      { transaction }
    );

    const firstMessage = await ConversationMessage.create(
      {
        conversationId: conversation.id,
        schoolId,
        senderUserId: userId,
        senderPlatformUserId: null,
        message,
        imageUrl,
        imageKey,
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Support conversation created successfully.",
      data: {
        conversation,
        firstMessage,
      },
    });
  } catch (error) {
    try {
      await rollbackIfNeeded(transaction);
    } catch (rollbackError) {
      return next(rollbackError);
    }

    return next(error);
  }
};

// ==========================================
// 2. GET MY CONVERSATIONS
// ==========================================

export const getMyConversations = async (req, res, next) => {
  try {
    requireSupportAccess(req);

    const { userId, schoolId } = getSchoolUser(req);
    const { page, limit, offset } = getPagination(req.query);

    const where = {
      schoolId,
      createdByUserId: userId,
    };

    if (req.query.status) {
      where.status = req.query.status;
    }

    if (req.query.category) {
      where.category = req.query.category;
    }

    const { count, rows: conversations } =
      await SupportConversation.findAndCountAll({
        where,
        order: [
          ["updatedAt", "DESC"],
          ["createdAt", "DESC"],
        ],
        limit,
        offset,
      });

    const conversationIds = conversations.map(
      (conversation) => conversation.id
    );

    // Fetch messages for this page in one query instead of one query
    // per conversation.
    const recentMessages = conversationIds.length
      ? await ConversationMessage.findAll({
          where: {
            schoolId,
            conversationId: {
              [Op.in]: conversationIds,
            },
          },
          attributes: [
            "id",
            "conversationId",
            "senderUserId",
            "senderPlatformUserId",
            "message",
            "imageUrl",
            "createdAt",
          ],
          order: [["createdAt", "DESC"], ["id", "DESC"]],
        })
      : [];

    const latestMessageByConversation = new Map();

    for (const item of recentMessages) {
      if (!latestMessageByConversation.has(item.conversationId)) {
        latestMessageByConversation.set(
          item.conversationId,
          item
        );
      }
    }

    const conversationsWithPreview = conversations.map(
      (conversation) => ({
        ...conversation.toJSON(),
        lastMessage:
          latestMessageByConversation.get(conversation.id) ?? null,
      })
    );

    return res.status(200).json({
      success: true,
      data: {
        conversations: conversationsWithPreview,
        pagination: {
          totalItems: count,
          currentPage: page,
          pageSize: limit,
          totalPages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

// ==========================================
// 3. GET CONVERSATION MESSAGES
// ==========================================

export const getConversationMessages = async (req, res, next) => {
  try {
    requireSupportAccess(req);

    const { userId, schoolId } = getSchoolUser(req);
    const { conversationId } = req.params;
    const { page, limit, offset } = getPagination(req.query, 50);

    await findMyConversation({
      conversationId,
      schoolId,
      userId,
    });

    const { count, rows: messages } =
      await ConversationMessage.findAndCountAll({
        where: {
          conversationId,
          schoolId,
        },
        order: [
          ["createdAt", "ASC"],
          ["id", "ASC"],
        ],
        limit,
        offset,
      });

    return res.status(200).json({
      success: true,
      data: {
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
    return next(error);
  }
};

// ==========================================
// 4. SEND MESSAGE
// ==========================================

export const sendMessage = async (req, res, next) => {
  let transaction;

  try {
    requireSupportAccess(req);

    const { userId, schoolId } = getSchoolUser(req);
    const { conversationId } = req.params;
    const { message, imageUrl, imageKey } =
      getMessageContent(req.body);

    transaction = await dbConnection.transaction();

    const conversation = await findMyConversation({
      conversationId,
      schoolId,
      userId,
      transaction,
      lock: true,
    });

    if (CLOSED_STATUSES.includes(conversation.status)) {
      throw new AppError(
        "This conversation is no longer active. Reopen it before sending another message.",
        409
      );
    }

    const newMessage = await ConversationMessage.create(
      {
        conversationId: conversation.id,
        schoolId,
        senderUserId: userId,
        senderPlatformUserId: null,
        message,
        imageUrl,
        imageKey,
      },
      { transaction }
    );

    // Keep the conversation inbox ordered by recent activity.
    conversation.changed("updatedAt", true);
    await conversation.save({ transaction });

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Message sent successfully.",
      data: {
        message: newMessage,
      },
    });
  } catch (error) {
    try {
      await rollbackIfNeeded(transaction);
    } catch (rollbackError) {
      return next(rollbackError);
    }

    return next(error);
  }
};

// ==========================================
// 5. REOPEN CONVERSATION
// ==========================================

export const reopenConversation = async (req, res, next) => {
  let transaction;

  try {
    requireSupportAccess(req);

    const { userId, schoolId } = getSchoolUser(req);
    const { conversationId } = req.params;

    transaction = await dbConnection.transaction();

    const conversation = await findMyConversation({
      conversationId,
      schoolId,
      userId,
      transaction,
      lock: true,
    });

    if (conversation.status !== "RESOLVED") {
      throw new AppError(
        "Only resolved conversations can be reopened.",
        409
      );
    }

    conversation.status = "OPEN";
    conversation.resolvedAt = null;

    await conversation.save({ transaction });
    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Support conversation reopened successfully.",
      data: {
        conversation,
      },
    });
  } catch (error) {
    try {
      await rollbackIfNeeded(transaction);
    } catch (rollbackError) {
      return next(rollbackError);
    }

    return next(error);
  }
};
