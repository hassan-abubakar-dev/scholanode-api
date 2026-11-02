import express from "express";
import {
  getSchoolClasses,
  assignFormMaster
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

router.patch(
  "/class/:classId/form-master",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  assignFormMaster
);

export default router;