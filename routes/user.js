import express from 'express';
import {
  protectRoutes,
  authorize,
} from '../middleware/auth.js';
import {
  registerStudent,
  registerTeacher,
} from '../controllers/user.js';

const router = express.Router();

router.use(protectRoutes, authorize('ADMINISTRATOR', 'PRINCIPAL'));

router.post('/students', registerStudent);
router.post('/teachers', registerTeacher);

export default router;