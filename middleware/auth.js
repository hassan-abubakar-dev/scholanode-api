import jwt from "jsonwebtoken";
import AppError from "../utils/AppError.js";
import { Owner, User } from "../relationships/associations.js";

// General school management permissions
const SCHOOL_MANAGEMENT_ROLES = [
  "LEADER",
  "VICE_LEADER",
  "ADMINISTRATOR",
];

// Academic configuration and examination permissions
const ACADEMIC_MANAGEMENT_ROLES = [
  "LEADER",
  "VICE_LEADER",
  "EXAM_OFFICER",
];

export const protectRoutes = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(
        new AppError("Not logged in or invalid token", 401)
      );
    }

    const token = authHeader.split(" ")[1].trim();

    const decoded = jwt.verify(
      token,
      process.env.ACCESS_TOKEN_KEY
    );

    // Live database security check
    const currentUser = await User.findByPk(decoded.id);

    if (!currentUser) {
      return next(
        new AppError(
          "The user belonging to this token no longer exists.",
          401
        )
      );
    }

    if (currentUser.status !== "ACTIVE") {
      return next(
        new AppError("Your account is not active.", 403)
      );
    }

    // Attach authenticated user information
    req.user = {
      id: currentUser.id,
      schoolId: currentUser.schoolId,
      loginId: currentUser.loginId,
      role: currentUser.role,
      lastNotificationCheck: currentUser.lastNotificationCheck,
    };

    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return next(new AppError("Token expired", 401));
    }

    return next(new AppError("Invalid token", 401));
  }
};

// Generic role authorization
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(
          "User role not authorized to access this route",
          403
        )
      );
    }

    next();
  };
};

// General school management authorization
// Allows LEADER, VICE_LEADER, ADMINISTRATOR and verified OWNER.
export const authorizeSchoolManagement = async (req, res, next) => {
  try {
    const { id: userId, schoolId, role } = req.user || {};

    if (!userId || !schoolId) {
      return next(
        new AppError(
          "You are not authorized to access this resource.",
          403
        )
      );
    }

    // Allow authorized school management roles
    if (SCHOOL_MANAGEMENT_ROLES.includes(role)) {
      return next();
    }

    // OWNER is a separate entity, not a User role.
    // Verify ownership through the Owner model.
    const owner = await Owner.findOne({
      where: {
        userId,
        schoolId,
      },
      attributes: ["id"],
    });

    if (!owner) {
      return next(
        new AppError(
          "You are not authorized to access this resource.",
          403
        )
      );
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

// Academic management authorization
// Allows only LEADER, VICE_LEADER and EXAM_OFFICER.
export const authorizeAcademicManagement = (req, res, next) => {
  const { role } = req.user || {};

  if (!ACADEMIC_MANAGEMENT_ROLES.includes(role)) {
    return next(
      new AppError(
        "Only the school Leader, Vice Leader or Examination Officer can access this resource.",
        403
      )
    );
  }

  next();
};