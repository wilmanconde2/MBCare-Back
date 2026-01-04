// /mbcare-backend/routes/authRoutes.js

import express from "express";
import {
    registerFundador,
    loginUser,
    changePassword,
    getProfile,
    verifyTokenController,
} from "../controllers/authController.js";

import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/register", registerFundador);
router.post("/login", loginUser);

router.put("/change-password", protect, changePassword);

router.get("/profile", protect, getProfile);

router.get("/verify", protect, verifyTokenController);

router.post("/logout", (req, res) => {
    res.clearCookie("token");
    res.status(200).json({ message: "Logout correcto" });
});

export default router;
