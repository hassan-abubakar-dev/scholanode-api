import { Op, Transaction } from "sequelize";

import {
  PlatformUser,
  SupportConversation,
  ConversationMessage,
  School,
  User,
} from "../relationships/associations.js";

import { dbConnection } from "../config/db.js";
import AppError from "../utils/AppError.js";

const PLATFORM_ROLES = ["PLATFORM_ADMIN", "SUPPORT_AGENT"];

const PAGE_DEFAULT = 1;
const LIMIT_DEFAULT = 20;
const LIMIT_MAX = 100;

const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const success = (res, data, statusCode = 200) =>
  res.status(statusCode).json({
    success: true,
    data,
  });

function getActor(req) {
  const actor = req.platformUser ?? req.user;

  if (!actor?.id || !PLATFORM_ROLES.includes(actor.role)) {
    throw new AppError("Platform authentication is required.", 401);
  }

  if (actor.status && actor.status !== "ACTIVE") {
    throw new AppError("Your platform account is not active.", 403);
  }

  return actor;
}

function requirePlatformAdmin(actor) {
  if (actor.role !== "PLATFORM_ADMIN") {
    throw new AppError(
      "Only platform administrators can perform this action.",
      403
    );
  }
}

function getPagination(query = {}) {
  const page = Math.max(
    1,
    Number.parseInt(query.page, 10) || PAGE_DEFAULT
  );

  const requestedLimit =
    Number.parseInt(query.limit, 10) || LIMIT_DEFAULT;

  const limit = Math.min(
    LIMIT_MAX,
    Math.max(1, requestedLimit)
  );

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

function getConversationId(req) {
  const conversationId =
    req.params?.conversationId ??
    req.validatedParams?.conversationId;

  if (!conversationId) {
    throw new AppError("A conversation ID is required.", 400);
  }

  return conversationId;
}

async function findConversation(conversationId, options = {}) {
  const conversation = await SupportConversation.findByPk(
    conversationId,
    options
  );

  if (!conversation) {
    throw new AppError("Support conversation not found.", 404);
  }

  return conversation;
}

function assertConversationIsActive(conversation) {
  if (conversation.status === "CLOSED") {
    throw new AppError(
      "This conversation is closed. Reopen it before continuing.",
      409
    );
  }

  if (conversation.status === "RESOLVED") {
    throw new AppError(
      "This conversation is resolved. Reopen it before continuing.",
      409
    );
  }
}

function assertHandlerOrAdmin(conversation, actor) {
  if (conversation.currentHandlerId !== actor.id) {
    throw new AppError(
      "You must be the active handler to perform this action.",
      403
    );
  }
}

function assertCanHandleEscalation(conversation, actor) {
  if (
    conversation.isEscalated &&
    actor.role !== "PLATFORM_ADMIN"
  ) {
    throw new AppError(
      "This conversation is escalated and requires platform-admin attention.",
      403
    );
  }
}

async function getLockedConversation(conversationId, transaction) {
  return findConversation(conversationId, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
}

const messageSenderIncludes = [
  {
    model: User,
    as: "senderUser",
    attributes: ["id", "firstName", "surName", "loginId"],
    required: false,
  },
  {
    model: PlatformUser,
    as: "senderPlatformUser",
    attributes: ["id", "firstName", "surName", "role"],
    required: false,
  },
];

// ============================================================
// 1. SHARED: SUPPORT INBOX
// ============================================================

export const getSupportInbox = asyncHandler(async (req, res) => {
  const actor = getActor(req);
  const query = req.validatedQuery ?? req.query ?? {};
  const { page, limit, offset } = getPagination(query);

  const where = {};

  if (query.status) where.status = query.status;
  if (query.category) where.category = query.category;
  if (query.schoolId) where.schoolId = query.schoolId;
  if (query.conversationId) where.id = query.conversationId;

  if (query.handlerId) {
    where.currentHandlerId = query.handlerId;
  }

  if (query.unassigned === true || query.unassigned === "true") {
    where.currentHandlerId = null;
  }

  if (actor.role === "SUPPORT_AGENT") {
    // Agents must not handle cases waiting in the escalation queue.
    where.isEscalated = false;

    // Agents see unassigned conversations and conversations assigned
    // to themselves, but not conversations assigned to other agents.
    where[Op.or] = [
      { currentHandlerId: null },
      { currentHandlerId: actor.id },
    ];
  } else if (
    query.isEscalated !== undefined &&
    query.isEscalated !== ""
  ) {
    where.isEscalated =
      query.isEscalated === true ||
      query.isEscalated === "true";
  }

  const { count, rows } = await SupportConversation.findAndCountAll({
    where,
    distinct: true,
    limit,
    offset,
    order: [
      ["updatedAt", "DESC"],
      ["createdAt", "DESC"],
    ],
    include: [
      {
        model: School,
        as: "school",
        attributes: ["id"],
        required: false,
      },
      {
        model: User,
        as: "createdBy",
        attributes: ["id", "firstName", "surName", "loginId"],
        required: false,
      },
      {
        model: PlatformUser,
        as: "currentHandler",
        attributes: ["id", "firstName", "surName", "role"],
        required: false,
      },
      {
        model: PlatformUser,
        as: "escalatedByUser",
        attributes: ["id", "firstName", "surName", "role"],
        required: false,
      },
      {
        model: ConversationMessage,
        as: "messages",
        separate: true,
        limit: 1,
        order: [["createdAt", "DESC"]],
        attributes: [
          "id",
          "conversationId",
          "senderUserId",
          "senderPlatformUserId",
          "message",
          "imageUrl",
          "createdAt",
        ],
      },
    ],
  });

  return success(res, {
    conversations: rows,
    pagination: {
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
      hasNextPage: offset + rows.length < count,
      hasPreviousPage: page > 1,
    },
  });
});

// ============================================================
// 2. SHARED: GET CONVERSATION MESSAGES
// ============================================================

export const getConversationMessages = asyncHandler(
  async (req, res) => {
    const actor = getActor(req);
    const conversationId = getConversationId(req);
    const query = req.validatedQuery ?? req.query ?? {};
    const { page, limit, offset } = getPagination(query);

    const conversation = await findConversation(conversationId);

    // A support agent may only inspect conversations available to
    // the normal support queue. Admins may inspect any conversation.
    if (
      actor.role === "SUPPORT_AGENT" &&
      conversation.isEscalated
    ) {
      throw new AppError(
        "This conversation is in the escalation queue.",
        403
      );
    }

    const { count, rows } =
      await ConversationMessage.findAndCountAll({
        where: {
          conversationId,
          schoolId: conversation.schoolId,
        },
        include: messageSenderIncludes,
        order: [["createdAt", "DESC"], ["id", "DESC"]],
        limit,
        offset,
      });

    // Return each page in chronological order for chat rendering.
    rows.reverse();

    return success(res, {
      conversation,
      messages: rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
        hasNextPage: offset + rows.length < count,
        hasPreviousPage: page > 1,
      },
    });
  }
);

// ============================================================
// 3. SHARED: CLAIM CONVERSATION
// ============================================================

export const claimConversation = asyncHandler(async (req, res) => {
  const actor = getActor(req);
  const conversationId = getConversationId(req);

  const conversation = await dbConnection.transaction(
    {
      isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
    },
    async (transaction) => {
      const current = await getLockedConversation(
        conversationId,
        transaction
      );

      assertCanHandleEscalation(current, actor);

      if (["RESOLVED", "CLOSED"].includes(current.status)) {
        throw new AppError(
          "Reopen this conversation before claiming it.",
          409
        );
      }

      if (current.currentHandlerId === actor.id) {
        return current;
      }

      if (current.currentHandlerId) {
        throw new AppError(
          "Another support agent is already handling this conversation.",
          409
        );
      }

      current.currentHandlerId = actor.id;
      current.status = "IN_PROGRESS";
      current.resolvedAt = null;
      current.closedAt = null;

      await current.save({ transaction });

      return current;
    }
  );

  return success(res, {
    message: "Conversation claimed successfully.",
    conversation,
  });
});

// ============================================================
// 4. SHARED: RELEASE CONVERSATION
// ============================================================

export const releaseConversation = asyncHandler(
  async (req, res) => {
    const actor = getActor(req);
    const conversationId = getConversationId(req);

    const conversation = await dbConnection.transaction(
      async (transaction) => {
        const current = await getLockedConversation(
          conversationId,
          transaction
        );

        if (
          current.isEscalated &&
          actor.role !== "PLATFORM_ADMIN"
        ) {
          throw new AppError(
            "Escalated conversations must be managed by a platform administrator.",
            403
          );
        }

        if (!current.currentHandlerId) {
          throw new AppError(
            "This conversation has no active handler.",
            409
          );
        }

        // Admins can release another handler's conversation.
        // Agents can release only their own.
        if (
          actor.role !== "PLATFORM_ADMIN" &&
          current.currentHandlerId !== actor.id
        ) {
          throw new AppError(
            "You cannot release another agent's conversation.",
            403
          );
        }

        current.currentHandlerId = null;

        if (current.status === "IN_PROGRESS") {
          current.status = "OPEN";
        }

        await current.save({ transaction });

        return current;
      }
    );

    return success(res, {
      message: "Conversation released successfully.",
      conversation,
    });
  }
);

// ============================================================
// 5. SHARED: SEND PLATFORM MESSAGE
// ============================================================

export const sendConversationMessage = asyncHandler(
  async (req, res) => {
    const actor = getActor(req);
    const conversationId = getConversationId(req);
    const body = req.validatedBody ?? req.body ?? {};

    const message =
      typeof body.message === "string" &&
      body.message.trim().length > 0
        ? body.message.trim()
        : null;

    const imageUrl = body.imageUrl || null;
    const imageKey = body.imageKey || null;

    if (!message && !imageUrl) {
      throw new AppError(
        "Enter a message or attach an image.",
        400
      );
    }

    if (Boolean(imageUrl) !== Boolean(imageKey)) {
      throw new AppError(
        "Image URL and image key must be supplied together.",
        400
      );
    }

    // TODO: Verify imageUrl/imageKey against your trusted R2 upload
    // record or upload service. Do not accept arbitrary object keys.

    const createdMessage = await dbConnection.transaction(
      async (transaction) => {
        const conversation = await getLockedConversation(
          conversationId,
          transaction
        );

        assertCanHandleEscalation(conversation, actor);
        assertConversationIsActive(conversation);
        assertHandlerOrAdmin(conversation, actor);

        const newMessage = await ConversationMessage.create(
          {
            conversationId: conversation.id,
            schoolId: conversation.schoolId,
            senderUserId: null,
            senderPlatformUserId: actor.id,
            message,
            imageUrl,
            imageKey,
          },
          { transaction }
        );

        // Keep inbox ordering aligned with the latest activity.
        await conversation.update(
          { updatedAt: new Date() },
          { transaction }
        );

        return newMessage;
      }
    );

    const messageWithSender =
      await ConversationMessage.findByPk(createdMessage.id, {
        include: messageSenderIncludes,
      });

    return success(
      res,
      {
        message: "Reply sent successfully.",
        conversationMessage: messageWithSender,
      },
      201
    );
  }
);

// ============================================================
// 6. SHARED: RESOLVE CONVERSATION
// ============================================================

export const resolveConversation = asyncHandler(
  async (req, res) => {
    const actor = getActor(req);
    const conversationId = getConversationId(req);

    const conversation = await dbConnection.transaction(
      async (transaction) => {
        const current = await getLockedConversation(
          conversationId,
          transaction
        );

        assertCanHandleEscalation(current, actor);
        assertHandlerOrAdmin(current, actor);

        if (current.status === "CLOSED") {
          throw new AppError(
            "A closed conversation cannot be resolved again.",
            409
          );
        }

        if (current.status === "RESOLVED") {
          return current;
        }

        current.status = "RESOLVED";
        current.resolvedAt = new Date();
        current.closedAt = null;
        current.currentHandlerId = null;

        await current.save({ transaction });

        return current;
      }
    );

    return success(res, {
      message: "Conversation resolved successfully.",
      conversation,
    });
  }
);

// ============================================================
// 7. SHARED: CLOSE CONVERSATION
// ============================================================

export const closeConversation = asyncHandler(
  async (req, res) => {
    const actor = getActor(req);
    const conversationId = getConversationId(req);

    const conversation = await dbConnection.transaction(
      async (transaction) => {
        const current = await getLockedConversation(
          conversationId,
          transaction
        );

        assertCanHandleEscalation(current, actor);
        assertHandlerOrAdmin(current, actor);

        if (current.status === "CLOSED") {
          return current;
        }

        current.status = "CLOSED";
        current.closedAt = new Date();
        current.currentHandlerId = null;

        await current.save({ transaction });

        return current;
      }
    );

    return success(res, {
      message: "Conversation closed successfully.",
      conversation,
    });
  }
);

// ============================================================
// 8. SHARED: ESCALATE CONVERSATION
// ============================================================

export const escalateConversation = asyncHandler(
  async (req, res) => {
    const actor = getActor(req);
    const conversationId = getConversationId(req);
    const body = req.validatedBody ?? req.body ?? {};

    const reason =
      typeof body.reason === "string"
        ? body.reason.trim()
        : "";

    if (reason.length < 5 || reason.length > 2000) {
      throw new AppError(
        "Provide an escalation reason between 5 and 2000 characters.",
        400
      );
    }

    const conversation = await dbConnection.transaction(
      async (transaction) => {
        const current = await getLockedConversation(
          conversationId,
          transaction
        );

        if (current.status === "CLOSED") {
          throw new AppError(
            "Closed conversations cannot be escalated.",
            409
          );
        }

        if (current.isEscalated) {
          throw new AppError(
            "This conversation is already escalated.",
            409
          );
        }

        // Agents may escalate only conversations they currently handle.
        // Admins may escalate any non-closed conversation.
        if (
          actor.role !== "PLATFORM_ADMIN" &&
          current.currentHandlerId !== actor.id
        ) {
          throw new AppError(
            "You must be the active handler to escalate this conversation.",
            403
          );
        }

        current.isEscalated = true;
        current.escalatedBy = actor.id;
        current.escalatedAt = new Date();
        current.escalationReason = reason;
        current.currentHandlerId = null;

        await current.save({ transaction });

        return current;
      }
    );

    return success(res, {
      message: "Conversation escalated successfully.",
      conversation,
    });
  }
);

// ============================================================
// 9. SUPER ADMIN ONLY: ESCALATED QUEUE
// ============================================================

export const getEscalatedConversations = asyncHandler(
  async (req, res) => {
    const actor = getActor(req);
    requirePlatformAdmin(actor);

    const query = req.validatedQuery ?? req.query ?? {};
    const { page, limit, offset } = getPagination(query);

    const where = { isEscalated: true };

    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;
    if (query.schoolId) where.schoolId = query.schoolId;

    const { count, rows } =
      await SupportConversation.findAndCountAll({
        where,
        distinct: true,
        limit,
        offset,
        order: [
          ["escalatedAt", "ASC"],
          ["updatedAt", "DESC"],
        ],
        include: [
          {
            model: School,
            as: "school",
            attributes: ["id"],
            required: false,
          },
          {
            model: User,
            as: "createdBy",
            attributes: ["id", "firstName", "surName", "loginId"],
            required: false,
          },
          {
            model: PlatformUser,
            as: "escalatedByUser",
            attributes: ["id", "firstName", "surName", "role"],
            required: false,
          },
          {
            model: ConversationMessage,
            as: "messages",
            separate: true,
            limit: 1,
            order: [["createdAt", "DESC"]],
            attributes: [
              "id",
              "conversationId",
              "senderUserId",
              "senderPlatformUserId",
              "message",
              "imageUrl",
              "createdAt",
            ],
          },
        ],
      });

    return success(res, {
      conversations: rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
        hasNextPage: offset + rows.length < count,
        hasPreviousPage: page > 1,
      },
    });
  }
);

// ============================================================
// 10. SUPER ADMIN ONLY: TAKE OVER ESCALATED CONVERSATION
// ============================================================

export const takeOverConversation = asyncHandler(
  async (req, res) => {
    const actor = getActor(req);
    requirePlatformAdmin(actor);

    const conversationId = getConversationId(req);

    const conversation = await dbConnection.transaction(
      async (transaction) => {
        const current = await getLockedConversation(
          conversationId,
          transaction
        );

        if (!current.isEscalated) {
          throw new AppError(
            "Only escalated conversations can be taken over here.",
            409
          );
        }

        if (current.status === "CLOSED") {
          throw new AppError(
            "Reopen this conversation before taking it over.",
            409
          );
        }

        current.currentHandlerId = actor.id;
        current.status = "IN_PROGRESS";
        current.resolvedAt = null;
        current.closedAt = null;

        // Keep isEscalated true until the admin explicitly returns
        // the conversation to the normal support queue.
        await current.save({ transaction });

        return current;
      }
    );

    return success(res, {
      message: "Escalated conversation taken over successfully.",
      conversation,
    });
  }
);

// ============================================================
// 11. SUPER ADMIN ONLY: RETURN TO NORMAL QUEUE
// ============================================================

export const returnEscalatedConversation = asyncHandler(
  async (req, res) => {
    const actor = getActor(req);
    requirePlatformAdmin(actor);

    const conversationId = getConversationId(req);

    const conversation = await dbConnection.transaction(
      async (transaction) => {
        const current = await getLockedConversation(
          conversationId,
          transaction
        );

        if (!current.isEscalated) {
          throw new AppError(
            "This conversation is not escalated.",
            409
          );
        }

        current.isEscalated = false;
        current.escalatedBy = null;
        current.escalatedAt = null;
        current.escalationReason = null;
        current.currentHandlerId = null;
        current.status = "OPEN";
        current.resolvedAt = null;
        current.closedAt = null;

        await current.save({ transaction });

        return current;
      }
    );

    return success(res, {
      message: "Conversation returned to the normal support queue.",
      conversation,
    });
  }
);

// ============================================================
// 12. SHARED: REOPEN CONVERSATION
// ============================================================

export const reopenConversation = asyncHandler(
  async (req, res) => {
    const actor = getActor(req);
    const conversationId = getConversationId(req);

    const conversation = await dbConnection.transaction(
      async (transaction) => {
        const current = await getLockedConversation(
          conversationId,
          transaction
        );

        assertCanHandleEscalation(current, actor);

        // Only the active handler or a platform admin may reopen.
        if (
          actor.role !== "PLATFORM_ADMIN" &&
          current.currentHandlerId !== actor.id
        ) {
          throw new AppError(
            "Only the active handler or a platform administrator can reopen this conversation.",
            403
          );
        }

        if (
          current.status !== "RESOLVED" &&
          current.status !== "CLOSED"
        ) {
          throw new AppError(
            "Only resolved or closed conversations can be reopened.",
            409
          );
        }

        current.status = "OPEN";
        current.currentHandlerId = null;
        current.resolvedAt = null;
        current.closedAt = null;

        await current.save({ transaction });

        return current;
      }
    );

    return success(res, {
      message: "Conversation reopened successfully.",
      conversation,
    });
  }
);