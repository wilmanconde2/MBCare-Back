// /mbcare-backend/routes/userRoutes.js

import express from "express";
import {
    crearUsuarioSecundario,
    toggleUsuarioActivo,
    listarUsuarios,
    cambiarRolUsuario,
    actualizarMiNombre,
} from "../controllers/userController.js";

import { protect } from "../middlewares/authMiddleware.js";
import { hasAccess } from "../middlewares/hasAccess.js";

const router = express.Router();

/**
 * 🟢 Crear usuario Profesional o Asistente (Solo Fundador)
 */
router.post("/crear", protect, hasAccess("Fundador"), crearUsuarioSecundario);

/**
 * 🔄 Activar o desactivar un usuario (Solo Fundador)
 */
router.put("/activar-desactivar/:id", protect, hasAccess("Fundador"), toggleUsuarioActivo);

/**
 * 🧩 Cambiar rol de un usuario (Solo Fundador)
 */
router.patch("/:id/rol", protect, hasAccess("Fundador"), cambiarRolUsuario);

/**
 * 📋 Listar usuarios (todos los roles, con filtro interno)
 */
router.get("/", protect, hasAccess(["Fundador", "Profesional", "Asistente"]), listarUsuarios);

/**
 * ✅ NUEVO: actualizar nombre del usuario autenticado (todos los roles)
 * Perfil Personal: SOLO nombre completo
 */
router.patch(
    "/me/nombre",
    protect,
    hasAccess(["Fundador", "Profesional", "Asistente"]),
    actualizarMiNombre
);

export default router;
