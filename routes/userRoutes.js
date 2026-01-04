// /mbcare-backend/routes/userRoutes.js

import express from "express";
import {
    crearUsuarioSecundario,
    toggleUsuarioActivo,
    listarUsuarios,
    cambiarRolUsuario,
} from "../controllers/userController.js";

import { protect } from "../middlewares/authMiddleware.js";
import { hasAccess } from "../middlewares/hasAccess.js";

const router = express.Router();

/**
 * 🟢 Crear usuario Profesional o Asistente
 * Solo el Fundador puede hacer esto
 */
router.post("/crear", protect, hasAccess("Fundador"), crearUsuarioSecundario);

/**
 * 🔄 Activar o desactivar un usuario
 * Solo el Fundador puede hacer esto
 */
router.put("/activar-desactivar/:id", protect, hasAccess("Fundador"), toggleUsuarioActivo);

/**
 * 🧩 Cambiar rol de un usuario
 * Solo Fundador
 * No se puede modificar rol del Fundador
 */
router.patch("/:id/rol", protect, hasAccess("Fundador"), cambiarRolUsuario);

/**
 * 📋 Listar usuarios de la organización actual
 * Fundador puede ver todos
 * Profesional/Asistente también (según lógica del controller)
 */
router.get("/", protect, hasAccess(["Fundador", "Profesional", "Asistente"]), listarUsuarios);

export default router;
