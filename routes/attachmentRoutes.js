import express from "express";
import {
    subirAdjunto,
    obtenerAdjuntosPorPaciente,
    eliminarAdjunto,
} from "../controllers/attachmentController.js";

import { protect } from "../middlewares/authMiddleware.js";
import { hasAccess } from "../middlewares/hasAccess.js";
import { upload } from "../middlewares/multer.js"; // debe usar memoryStorage

const router = express.Router();

/**
 * 📤 Subir archivo clínico
 * Permitido: Fundador, Profesional
 * Asistente: NO
 */
router.post(
    "/subir",
    protect,
    hasAccess(["Fundador", "Profesional"]),
    upload.single("archivo"),
    subirAdjunto
);

/**
 * 🔍 Obtener adjuntos de un paciente
 * Fundador → todos
 * Profesional → solo los propios (controlado en controller)
 */
router.get(
    "/paciente/:pacienteId",
    protect,
    hasAccess(["Fundador", "Profesional"]),
    obtenerAdjuntosPorPaciente
);

/**
 * 🗑️ Eliminar adjunto
 * Fundador → todos
 * Profesional → solo los propios
 */
router.delete(
    "/:id",
    protect,
    hasAccess(["Fundador", "Profesional"]),
    eliminarAdjunto
);

export default router;
