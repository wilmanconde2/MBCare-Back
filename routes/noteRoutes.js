import express from "express";
import {
    crearNota,
    obtenerNotaPorId,
    editarNota,
    eliminarNota,
    obtenerNotasPorDocumento
} from "../controllers/noteController.js";

import { protect } from "../middlewares/authMiddleware.js";
import { hasAccess } from "../middlewares/hasAccess.js";

const router = express.Router();

// Crear nota clínica
router.post(
    "/",
    protect,
    hasAccess(["Fundador", "Profesional", "Asistente"]),
    crearNota
);

// Listar notas por documento
router.get(
    "/documento/:numeroDocumento",
    protect,
    hasAccess(["Fundador", "Profesional", "Asistente"]),
    obtenerNotasPorDocumento
);

// Obtener nota
router.get(
    "/:id",
    protect,
    hasAccess(["Fundador", "Profesional", "Asistente"]),
    obtenerNotaPorId
);

// Editar nota (Fundador + Profesional autor + Asistente)
router.put(
    "/:id",
    protect,
    hasAccess(["Fundador", "Profesional", "Asistente"]),
    editarNota
);

// Eliminar nota (Fundador + Profesional autor)
router.delete(
    "/:id",
    protect,
    hasAccess(["Fundador", "Profesional"]),
    eliminarNota
);

export default router;
