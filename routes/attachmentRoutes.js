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
 * 📤 Subir archivo clínico (Fundador o Profesional)
 */
router.post(
    "/subir",
    protect,
    hasAccess(["Fundador", "Profesional"]),
    upload.single("archivo"),
    subirAdjunto
);

/**
 * 🔍 Obtener todos los archivos de un paciente
 */
router.get(
    "/paciente/:pacienteId",
    protect,
    hasAccess(["Fundador", "Profesional"]),
    obtenerAdjuntosPorPaciente
);

/**
 * 🗑️ Eliminar archivo clínico
 */
router.delete(
    "/:id",
    protect,
    hasAccess(["Fundador", "Profesional"]),
    eliminarAdjunto
);

export default router;
