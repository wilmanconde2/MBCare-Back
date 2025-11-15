import express from "express";
import {
    crearCita,
    obtenerCitasOrganizacion,
    editarCita,
    cancelarCita,
    exportarCitas
} from "../controllers/appointmentController.js";

import { protect } from "../middlewares/authMiddleware.js";
import { hasAccess } from "../middlewares/hasAccess.js";

const router = express.Router();

/**
 * 🔍 Listar citas
 * Fundador → todas
 * Asistente → todas
 * Profesional → solo propias
 */
router.get(
    "/",
    protect,
    hasAccess(["Fundador", "Profesional", "Asistente"]),
    obtenerCitasOrganizacion
);

/**
 * 🟢 Crear cita
 * Fundador → todas
 * Asistente → todas
 * Profesional → siempre se asigna a sí mismo (validado en controller)
 */
router.post(
    "/",
    protect,
    hasAccess(["Fundador", "Profesional", "Asistente"]),
    crearCita
);

/**
 * 📝 Editar cita
 * Profesional solo edita las propias (validado en controller)
 */
router.put(
    "/:id",
    protect,
    hasAccess(["Fundador", "Profesional", "Asistente"]),
    editarCita
);

/**
 * ❌ Cancelar cita
 * Profesional solo cancela las propias (validado en controller)
 */
router.put(
    "/cancelar/:id",
    protect,
    hasAccess(["Fundador", "Profesional", "Asistente"]),
    cancelarCita
);

/**
 * 📤 Exportar citas
 * Profesional → bloqueado
 * Fundador/Asistente → permitido
 */
router.get(
    "/exportar",
    protect,
    hasAccess(["Fundador", "Asistente"]),
    exportarCitas
);

export default router;
