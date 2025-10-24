import express from "express";
import { crearCita, obtenerCitasOrganizacion, editarCita, cancelarCita, exportarCitas } from "../controllers/appointmentController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { hasAccess } from "../middlewares/hasAccess.js";

const router = express.Router();

// 🔍 Obtener citas de la organización
router.get("/", protect, hasAccess(["Fundador", "Profesional"]), obtenerCitasOrganizacion);

// Crear cita (solo Profesional o Fundador)
router.post("/", protect, hasAccess(["Fundador", "Profesional"]), crearCita);

// 📝 Editar una cita existente
router.put("/:id", protect, hasAccess(["Fundador", "Profesional"]), editarCita);

// ❌ Cancelar una cita
router.put("/cancelar/:id", protect, hasAccess(["Fundador", "Profesional"]), cancelarCita);

// 📤 Exportar citas resumidas
router.get("/exportar", protect, hasAccess(["Fundador", "Profesional"]), exportarCitas);


export default router;
