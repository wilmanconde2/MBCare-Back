import express from "express";
import { subirAdjunto, obtenerAdjuntosPorPaciente, eliminarAdjunto } from "../controllers/attachmentController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { hasAccess } from "../middlewares/hasAccess.js";
import upload from "../middlewares/uploadMiddleware.js";

const router = express.Router();

/**
 * 📤 Subir adjunto clínico
 * Solo Fundador o Profesional pueden subir
 * Body: paciente, descripcion (opcional)
 * File: archivo (en multipart/form-data)
 */
router.post(
    "/",
    protect,
    hasAccess(["Fundador", "Profesional"]),
    upload.single("archivo"),
    subirAdjunto
);

/**
 * 🔍 Ver adjuntos por paciente
 * Fundador o Profesional
 */
router.get(
    "/paciente/:pacienteId",
    protect,
    hasAccess(["Fundador", "Profesional"]),
    obtenerAdjuntosPorPaciente
);

/**
 * 🗑️ Eliminar un adjunto clínico
 * Fundador o quien lo subió
 */
router.delete(
    "/:id",
    protect,
    hasAccess(["Fundador", "Profesional"]),
    eliminarAdjunto
);

export default router;
