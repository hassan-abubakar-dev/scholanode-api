import express from "express";

import { createStudent, getAllStudents, importStudents } from "../controllers/student.js";
import { protectRoutes } from "../middleware/auth.js";
import validate from "../middleware/validation.js";
import { createStudentValidationSchema, getAllStudentsQueryValidationSchema, importStudentsSchema } from "../validation/student.js";

const router = express.Router();

router.post(
  "/create",
  protectRoutes,
  validate(createStudentValidationSchema),
  createStudent
);

router.get(
  "/get-all",
  protectRoutes,
  validate(getAllStudentsQueryValidationSchema, "query"),
  getAllStudents
);

router.post(
  "/import",
  protectRoutes,
  validate(importStudentsSchema),
  importStudents
);

export default router;