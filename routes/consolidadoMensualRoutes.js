import express from "express";
import {
    generarResumenMensual,
    exportarResumenMensualPDF
} from "../controllers/consolidadoMensualController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { hasAccess } from "../middlewares/hasAccess.js";

const router = express.Router();

/**
 * 📈 Generar resumen mensual de caja
 * SOLO Fundador puede generar y exportar
 * Requiere query param: ?mes=YYYY-MM
 */
router.get("/generar", protect, hasAccess(["Fundador"]), generarResumenMensual);
router.get("/pdf", protect, hasAccess(["Fundador"]), exportarResumenMensualPDF);

export default router;
