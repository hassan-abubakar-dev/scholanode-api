import { Op, fn, col, where, literal } from "sequelize";

import {
  Notification,
  User,
} from "../relationships/associations.js";

import { dbConnection } from "../config/db.js";
import AppError from "../utils/AppError.js";

// Map authenticated user roles to notification audiences.
export const getUserAudience = (role) => {
  const audienceByRole = {
    LEADER: "STAFF",
    VICE_LEADER: "STAFF",
    ADMINISTRATOR: "STAFF",
    EXAM_OFFICER: "STAFF",
    STAFF: "STAFF",
    STUDENT: "STUDENTS",
    PARENT: "PARENTS",
    SECURITY: "SECURITY",
  };

  return audienceByRole[role] || null;
};

// Build the audience condition for the active database dialect.
const getSharedAudienceCondition = (audience) => {
  const dialect = dbConnection.getDialect();
  const audienceJson = JSON.stringify([audience]);

  if (dialect === "postgres") {
    return literal(
      `"Notification"."audience"::jsonb @> '${audienceJson}'::jsonb`
    );
  }

  if (dialect === "mysql" || dialect === "mariadb") {
    return where(
      fn(
        "JSON_CONTAINS",
        col("audience"),
        audienceJson
      ),
      1
    );
  }

  throw new AppError(
    `Unsupported database dialect for notification audience filtering: ${dialect}`,
    500
  );
};

// Build the notification query for a user.
export const getNotificationWhere = ({
  schoolId,
  userId,
  audience,
  lastNotificationCheck,
}) => {
  const whereClause = {
    schoolId,

    [Op.or]: [
      {
        deliveryType: "INDIVIDUAL",
        recipientUserId: userId,
      },
      {
        deliveryType: "SHARED",
        [Op.and]: [
          getSharedAudienceCondition(audience),
        ],
      },
    ],
  };

  if (lastNotificationCheck) {
    whereClause.createdAt = {
      [Op.gt]: lastNotificationCheck,
    };
  }

  return whereClause;
};

// Calculate the latest unread count directly from the database.
export const getUnreadNotificationCountForUser = async (
  userId
) => {
  const user = await User.findByPk(userId);

  if (!user || user.status !== "ACTIVE" || !user.schoolId) {
    return null;
  }

  const audience = getUserAudience(user.role);

  if (!audience) {
    return null;
  }

  const where = getNotificationWhere({
    schoolId: user.schoolId,
    userId: user.id,
    audience,
    lastNotificationCheck: user.lastNotificationCheck,
  });

  return Notification.count({ where });
};