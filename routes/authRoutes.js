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

// Crear Fundador + Organización
router.post("/register", registerFundador);

// Login
router.post("/login", loginUser);

// Cambiar contraseña (requiere token)
router.put("/change-password", protect, changePassword);

// Obtener perfil del usuario autenticado
router.get("/profile", protect, getProfile);

// Verificar token en frontend
router.get("/verify", protect, verifyTokenController);

export default router;
