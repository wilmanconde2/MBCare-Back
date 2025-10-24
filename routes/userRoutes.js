import express from "express";
import {
    crearUsuarioSecundario,
    toggleUsuarioActivo,
    listarUsuarios,
} from "../controllers/userController.js";

import { protect } from "../middlewares/authMiddleware.js";
import { hasAccess } from "../middlewares/hasAccess.js";

const router = express.Router();

/**
 * 🟢 Crear usuario Profesional o Asistente
 * Solo el Fundador puede hacer esto
 */
router.post(
    "/crear",
    protect,
    hasAccess("Fundador"),
    crearUsuarioSecundario
);

/**
 * 🔄 Activar o desactivar un usuario
 * Solo el Fundador puede hacer esto
 */
router.put(
    "/activar-desactivar/:id",
    protect,
    hasAccess("Fundador"),
    toggleUsuarioActivo
);

/**
 * 📋 Listar usuarios de la organización actual
 * Fundador puede ver todos
 * Profesional puede ver solo sus compañeros
 * Asistente también
 */
router.get(
    "/",
    protect,
    hasAccess(["Fundador", "Profesional", "Asistente"]),
    listarUsuarios
);

export default router;
