import express from "express";

import { createStudent, getAllStudents, importStudents, getMyClass } from "../controllers/student.js";
import { authorize, protectRoutes } from "../middleware/auth.js";
import validate from "../middleware/validation.js";
import { createStudentValidationSchema, getAllStudentsQueryValidationSchema, importStudentsSchema } from "../validation/student.js";

const router = express.Router();

router.post(
  "/create",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  validate(createStudentValidationSchema),
  createStudent
);

router.get(
  "/get-all",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  validate(getAllStudentsQueryValidationSchema, "query"),
  getAllStudents
);

router.post(
  "/import",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  validate(importStudentsSchema),
  importStudents
);

router.get(
  "/my-class",
  protectRoutes,
  authorize("STUDENT"),
  getMyClass
);

export default router;