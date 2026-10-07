import express from "express";
import { loginUser, forgotLoginId, forgotPassword, resetPassword, requestNewAccessToken } from "../controllers/auth.js";

const router = express.Router();

router.post("/login", loginUser);
router.post("/forgot-login-id", forgotLoginId);

router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post('/refresh-token', requestNewAccessToken);
export default router;