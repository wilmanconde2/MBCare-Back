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

// Todas las rutas requieren token válido
router.use(protect);

// 🔹 Listar todos los pacientes
router.get("/", hasAccess("pacientes", "listar"), listarPacientes);

// 🔹 Crear paciente
router.post("/", hasAccess("pacientes", "crear"), crearPaciente);

// 🔹 Obtener un paciente específico
router.get("/:id", hasAccess("pacientes", "listar"), obtenerPacientePorId);

// 🔹 Actualizar paciente
router.put("/:id", hasAccess("pacientes", "editar"), actualizarPaciente);

// 🔹 Eliminar paciente (solo Fundador)
router.delete("/:id", hasAccess("pacientes", "eliminar"), eliminarPaciente);

export default router;
