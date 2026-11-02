import jwt from "jsonwebtoken";

import { PlatformUser } from "../relationships/associations.js";
import AppError from "../utils/AppError.js";

export const protectPlatformRoutes = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return next(new AppError("Platform authentication is required.", 401));
    }

    const token = authHeader.slice("Bearer ".length).trim();
    const decoded = jwt.verify(
      token,
      process.env.PLATFORM_ACCESS_TOKEN_KEY || process.env.ACCESS_TOKEN_KEY
    );

    const platformUser = await PlatformUser.findByPk(decoded.id);

    if (!platformUser) {
      return next(new AppError("Platform account not found.", 401));
    }

    if (platformUser.status !== "ACTIVE") {
      return next(new AppError("Your platform account is not active.", 403));
    }

    req.platformUser = {
      id: platformUser.id,
      email: platformUser.email,
      role: platformUser.role,
      status: platformUser.status,
    };

    return next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return next(new AppError("Platform token expired.", 401));
    }

    return next(new AppError("Invalid platform token.", 401));
  }
};

export const authorizePlatform = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.platformUser?.role)) {
      return next(
        new AppError(
          "You are not authorized to access this platform resource.",
          403
        )
      );
    }

    return next();
  };
};
