import express from "express";
import {
    crearPaciente,
    listarPacientes,
    obtenerPacientePorId,
    actualizarPaciente,
    eliminarPaciente,
} from "../controllers/patientController.js";

import { protect } from "../middlewares/authMiddleware.js";
import { hasAccess } from "../middlewares/hasAccess.js";

const router = express.Router();

router.use(protect);

// Listar todos los pacientes
router.get("/", hasAccess(["Fundador", "Profesional", "Asistente"]), listarPacientes);

// Crear paciente
router.post("/", hasAccess(["Fundador", "Profesional", "Asistente"]), crearPaciente);

// Obtener paciente
router.get("/:id", hasAccess(["Fundador", "Profesional", "Asistente"]), obtenerPacientePorId);

// Actualizar paciente
router.put("/:id", hasAccess(["Fundador", "Profesional", "Asistente"]), actualizarPaciente);

// Eliminar paciente (solo Fundador)
router.delete("/:id", hasAccess(["Fundador"]), eliminarPaciente);

export default router;
