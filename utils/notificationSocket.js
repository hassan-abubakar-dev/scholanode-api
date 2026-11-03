import { getIO } from "../config/socket.js";
import {
  getUnreadNotificationCountForUser,
} from "../services/notificationService.js";

export const emitNotificationCount = async (userId) => {
  try {
    const unreadCount =
      await getUnreadNotificationCountForUser(userId);

    if (unreadCount === null) return;

    const io = getIO();

    io.to(`user:${userId}`).emit(
      "notification_count_updated",
      {
        unreadCount,
      }
    );
  } catch (error) {
    // Notification creation should not fail because
    // a Socket.IO count update failed.
    console.error(
      "Failed to emit notification count:",
      error.message
    );
  }
};