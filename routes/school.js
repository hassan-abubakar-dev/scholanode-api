import express from "express";

import {
  checkSchoolCode,
  registerSchool,
  getSchoolSetupProgress,
  getSchoolByCode,
  getMySchool,
  updateSchoolSetup,
  createAcademicSetup,  
  createClassSetup,
  createSubjectSetup
} from "../controllers/school.js";

import {protectRoutes} from "../middleware/auth.js";

const router = express.Router();

// Register new school with admin and plan
router.post("/register", registerSchool);

router.get(
  "/setup-progress",
  protectRoutes,
  getSchoolSetupProgress
);


// Check whether a school code is available
router.get("/check-code", checkSchoolCode);




// Get school by code
router.get("/get/:code", getSchoolByCode);

// Get the logged-in user's school
router.get(
  "/my-school",
  protectRoutes,
  getMySchool
);

// Update school setup (optional fields)
router.patch("/:id/setup", updateSchoolSetup);

// Create academic setup for a school
router.post("/:id/academic-setup", createAcademicSetup);

// Create class setup for a school
router.post("/:id/class-setup", createClassSetup);

// Create subject setup for a school
router.post("/:id/subject-setup", createSubjectSetup);


export default router;
