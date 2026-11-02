import express from "express";
import { authorize, protectRoutes } from "../middleware/auth.js";
import { activateSubject, deactivateSubject, getAllSubjects, updateSubject } from "../controllers/subject.js";
import validate from "../middleware/validation.js";
import { updateSubjectSchema } from "../validation/subject.js";

const router = express.Router();

router.get(
  "/get-all",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  getAllSubjects
);

// Activate subject
router.patch(
  "/subject/:subjectId/activate",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  activateSubject
);

// Update subject
router.patch(
  "/subject/:subjectId",
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  validate(updateSubjectSchema, "body"),
  updateSubject
);

// Deactivate subject
router.patch(
  "/subject/:subjectId/deactivate", 
  protectRoutes,
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  deactivateSubject
);

export default router;