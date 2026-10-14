import express from "express";

import { createStudent } from "../controllers/student.js";
import { protectRoutes } from "../middleware/auth.js";
import validate from "../middleware/validation.js";
import { createStudentValidationSchema } from "../validation/student.js";

const router = express.Router();

router.post(
  "/create",
  protectRoutes,
  validate(createStudentValidationSchema),
  createStudent
);

export default router;