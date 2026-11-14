
import "dotenv/config";
import cors from "cors";

const configuredOrigins = String(process.env.CLIENT_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

const isLocalDevelopmentOrigin = (origin) => {
  try {
    const { hostname } = new URL(origin);

    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)
    );
  } catch {
    return false;
  }
};

export const isOriginAllowed = (origin) => {
  // Permit requests without an Origin header (e.g. Postman/server-to-server).
  if (!origin) return true;

  const normalizedOrigin = origin.replace(/\/$/, "");

  if (configuredOrigins.includes(normalizedOrigin)) {
    return true;
  }

  return (
    process.env.NODE_ENV !== "production" &&
    isLocalDevelopmentOrigin(normalizedOrigin)
  );
};

const corsMiddleware = cors({
  origin(origin, callback) {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

export default corsMiddleware;
