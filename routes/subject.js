import express from "express";
import { protectRoutes } from "../middleware/auth.js";
import { activateSubject, deactivateSubject, getAllSubjects, updateSubject } from "../controllers/subject.js";
import validate from "../middleware/validation.js";
import { updateSubjectSchema } from "../validation/subject.js";

const router = express.Router();

router.get(
  "/get-all",
  protectRoutes,
  getAllSubjects
);

// Activate subject
router.patch(
  "/subject/:subjectId/activate",
  protectRoutes,
  activateSubject
);

// Update subject
router.patch(
  "/subject/:subjectId",
  protectRoutes,
  validate(updateSubjectSchema, "body"),
  updateSubject
);

// Deactivate subject
router.patch(
  "/subject/:subjectId/deactivate", 
  protectRoutes,
  deactivateSubject
);

export default router;