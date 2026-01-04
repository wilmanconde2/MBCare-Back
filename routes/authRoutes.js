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

/**
 * Registro del Fundador
 * (solo se permite uno en todo el sistema)
 */
router.post("/register", registerFundador);

/**
 * Login
 */
router.post("/login", loginUser);

/**
 * 🔐 Cambiar contraseña del usuario autenticado
 * Requiere:
 * - currentPassword
 * - newPassword
 * - confirmPassword (opcional)
 */
router.patch("/change-password", protect, changePassword);

/**
 * 👤 Obtener perfil del usuario autenticado
 */
router.get("/profile", protect, getProfile);

/**
 * 🔁 Verificar token (keep alive frontend)
 */
router.get("/verify", protect, verifyTokenController);

/**
 * 🚪 Logout
 */
router.post("/logout", (req, res) => {
    res.clearCookie("token");
    res.status(200).json({ message: "Logout correcto" });
});

export default router;
