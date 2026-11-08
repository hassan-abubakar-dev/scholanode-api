import express from "express";
import {
  getSchoolClasses,
  assignFormMaster,
  getMyClassDetails,
  updateClass,
  deleteClass,
} from "../controllers/class.js";
import { authorize, protectRoutes } from "../middleware/auth.js";

const router = express.Router();

// Get all classes belonging to the authenticated school
router.get(
  "/get",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  getSchoolClasses
);

// Get assigned form master class details (with students & attendance snapshot)
router.get(
  "/my-class",
  protectRoutes,
  getMyClassDetails
);

// Assign or change class form master
router.patch(
  "/class/:classId/form-master",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  assignFormMaster
);

// Update class (level, arm, educational section)
router.put(
  "/class/:classId",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  updateClass
);
router.put(
  "/:classId",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  updateClass
);

// Delete class (with safety checks for enrolled students and attendance)
router.delete(
  "/class/:classId",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  deleteClass
);
router.delete(
  "/:classId",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  deleteClass
);

export default router;
