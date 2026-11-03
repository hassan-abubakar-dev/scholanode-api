import {
  Notification,
  User,
} from "../relationships/associations.js";

import AppError from "../utils/AppError.js";

import {
  getUserAudience,
  getNotificationWhere,
} from "../services/notificationService.js";

import {
  emitNotificationCount,
} from "../utils/notificationSocket.js";

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

// Validate and prepare pagination.
const getPagination = (query) => {
  const page = Math.max(Number(query.page) || 1, 1);

  const limit = Math.min(
    Math.max(Number(query.limit) || 15, 1),
    100
  );

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
};

// ==========================================
// 1. GET UNREAD NOTIFICATION COUNT
// ==========================================

export const getUnreadNotificationCount = async (
  req,
  res,
  next
) => {
  try {
    const schoolId = getSchoolId(req, next);

    if (!schoolId) return;

    const audience = getUserAudience(req.user.role);

    if (!audience) {
      throw new AppError(
        "Your role is not supported for notifications.",
        403
      );
    }

    const where = getNotificationWhere({
      schoolId,
      userId: req.user.id,
      audience,
      lastNotificationCheck: req.user.lastNotificationCheck,
    });

    const unreadCount = await Notification.count({
      where,
    });

    return res.status(200).json({
      success: true,
      message: "Unread notification count retrieved successfully.",
      data: {
        unreadCount,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// ==========================================
// 2. GET MY NOTIFICATIONS
// ==========================================

export const getMyNotifications = async (
  req,
  res,
  next
) => {
  try {
    const schoolId = getSchoolId(req, next);

    if (!schoolId) return;

    const audience = getUserAudience(req.user.role);

    if (!audience) {
      throw new AppError(
        "Your role is not supported for notifications.",
        403
      );
    }

    // Capture the check time before retrieving notifications.
    // Notifications created after this time remain unread.
    const checkedAt = new Date();

    const { page, limit, offset } = getPagination(
      req.query
    );

    // Retrieve all notifications applicable to this user.
    const where = getNotificationWhere({
      schoolId,
      userId: req.user.id,
      audience,
      lastNotificationCheck: null,
    });

    const { count, rows } =
      await Notification.findAndCountAll({
        where,
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      });

    // Update lastNotificationCheck through the User model.
    // req.user is a plain object, not a Sequelize instance.
    await User.update(
      {
        lastNotificationCheck: checkedAt,
      },
      {
        where: {
          id: req.user.id,
          schoolId,
        },
      }
    );

    // Notify all connected sessions of the updated unread count.
    // This also accounts for notifications created after checkedAt.
    await emitNotificationCount(req.user.id);

    return res.status(200).json({
      success: true,
      message: "Notifications retrieved successfully.",
      data: {
        notifications: rows,
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