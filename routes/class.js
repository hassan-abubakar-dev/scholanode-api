import express from "express";
import {
  getSchoolClasses,
  assignFormMaster
} from "../controllers/class.js";
import { protectRoutes } from "../middleware/auth.js";

const router = express.Router();

// Get all classes belonging to the authenticated school
router.get(
  "/get",
  protectRoutes,
  getSchoolClasses
);

router.patch(
  "/class/:classId/form-master",
  protectRoutes,
  assignFormMaster
);

export default router;