
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

import { User } from "../relationships/associations.js";
import { isOriginAllowed } from "./cors.js";

let io;

export const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
          return callback(null, true);
        }

        return callback(
          new Error("Origin not allowed by Socket.IO CORS")
        );
      },
      credentials: true,
    },

    // Enforce the same origin policy for incoming connections,
    // including WebSocket handshakes.
    allowRequest: (req, callback) => {
      callback(null, isOriginAllowed(req.headers.origin));
    },
  });

  // Authenticate socket connections.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error("Authentication required."));
      }

      const decoded = jwt.verify(
        token,
        process.env.ACCESS_TOKEN_KEY
      );

      const user = await User.findByPk(decoded.id);

      if (!user) {
        return next(new Error("User no longer exists."));
      }

      if (user.status !== "ACTIVE") {
        return next(new Error("Your account is not active."));
      }

      if (!user.schoolId) {
        return next(
          new Error("Your account is not associated with a school.")
        );
      }

      socket.user = {
        id: user.id,
        schoolId: user.schoolId,
        role: user.role,
      };

      next();
    } catch (error) {
      next(new Error("Invalid or expired authentication token."));
    }
  });

  io.on("connection", (socket) => {
    const userRoom = `user:${socket.user.id}`;

    socket.join(userRoom);

    console.log(`User connected to Socket.IO: ${socket.user.id}`);

    socket.on("disconnect", () => {
      console.log(`User disconnected from Socket.IO: ${socket.user.id}`);
    });
  });

  return io;
};

// Allow other files to access the initialized Socket.IO instance.
export const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO has not been initialized.");
  }

  return io;
};
