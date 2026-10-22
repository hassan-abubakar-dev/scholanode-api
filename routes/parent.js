import express from "express";

import { createParent, deleteParent, getAllParents, importParents, linkParentToStudent, unlinkParentFromStudent } from "../controllers/parent.js";
import { createParentSchema, deleteParentSchema, getAllParentsSchema, importParentsSchema, linkParentToStudentSchema, unlinkParentFromStudentSchema } from "../validation/parent.js";

import { authorize, protectRoutes } from "../middleware/auth.js";
import validate from "../middleware/validation.js";

const router = express.Router(); 

router.post(
  "/create",
  protectRoutes,
  validate(createParentSchema, "body"),
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  createParent
);

router.post(
  "/import-csv",
  protectRoutes,
  validate(importParentsSchema, "body"),
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  importParents
);

router.get(
  "/get-all",
  protectRoutes,
  validate(getAllParentsSchema, "query"),
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  getAllParents
);

router.post(
  "/link-student",
  protectRoutes,
  validate(linkParentToStudentSchema, "body"),
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  linkParentToStudent
);

router.delete(
  "/unlink-student",
  protectRoutes,
  validate(unlinkParentFromStudentSchema, "body"), 
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  unlinkParentFromStudent
);


router.delete(
  "/delete/:parentId",
  protectRoutes,
  validate(deleteParentSchema, "params"),
  authorize("LEADER", "VICE_LEADER", "ADMINISTRATOR"),
  deleteParent
);


export default router;