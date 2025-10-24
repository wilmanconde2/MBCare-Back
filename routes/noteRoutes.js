import express from "express";
import { crearNota, obtenerNotasPorPaciente, obtenerNotaPorId, editarNota, eliminarNota } from "../controllers/noteController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { hasAccess } from "../middlewares/hasAccess.js";

const router = express.Router();

/**
 * 📝 Crear una nota clínica
 * Solo Fundador y Profesional pueden crear
 */
router.post("/", protect, hasAccess(["Fundador", "Profesional"]), crearNota);

/**
 * 📋 Listar todas las notas de un paciente
 * Fundador y Profesional
 */
router.get(
    "/paciente/:pacienteId",
    protect,
    hasAccess(["Fundador", "Profesional"]),
    obtenerNotasPorPaciente
);

/**
 * 🔍 Obtener detalle de una nota clínica
 * Fundador y Profesional
 */
router.get(
    "/:id",
    protect,
    hasAccess(["Fundador", "Profesional"]),
    obtenerNotaPorId
);

/**
 * 📝 Editar una nota clínica
 * Solo Fundador o autor de la nota
 */
router.put(
    "/:id",
    protect,
    hasAccess(["Fundador", "Profesional"]),
    editarNota
);

/**
 * 🗑️ Eliminar una nota clínica
 * Fundador o autor
 */
router.delete(
    "/:id",
    protect,
    hasAccess(["Fundador", "Profesional"]),
    eliminarNota
);

export default router;

