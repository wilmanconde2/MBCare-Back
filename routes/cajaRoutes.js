import express from "express";
import {
    abrirCaja,
    cerrarCaja,
    historialCajas,
    exportarHistorialCajaPDF,
    estadoCajaHoy // ✅ NUEVO
} from "../controllers/cajaController.js";

import { generarResumen } from "../controllers/resumenCajaController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { hasAccess } from "../middlewares/hasAccess.js";

const router = express.Router();

// ✅ Estado de la caja de hoy (abierta / cerrada)
router.get(
    "/estado-hoy",
    protect,
    hasAccess(["Fundador", "Asistente"]),
    estadoCajaHoy
);

// Abrir caja: Fundador + Asistente
router.post(
    "/abrir",
    protect,
    hasAccess(["Fundador", "Asistente"]),
    abrirCaja
);

// Cerrar caja: Fundador + Asistente
router.post(
    "/cerrar",
    protect,
    hasAccess(["Fundador", "Asistente"]),
    cerrarCaja
);

// Resumen diario: Fundador
router.get(
    "/resumen",
    protect,
    hasAccess(["Fundador"]),
    generarResumen
);

// Historial: Fundador + Asistente
router.get(
    "/historial",
    protect,
    hasAccess(["Fundador", "Asistente"]),
    historialCajas
);

// Exportar PDF: Fundador
router.get(
    "/historial/exportar",
    protect,
    hasAccess(["Fundador"]),
    exportarHistorialCajaPDF
);

export default router;
