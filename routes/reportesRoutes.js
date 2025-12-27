import express from "express";
import {
    exportarCajaPDF,
    exportarNotasClinicasPDF,
    exportarNotasClinicasPDFPorParams,
} from "../controllers/reportesController.js";

import { protect } from "../middlewares/authMiddleware.js";
import { hasAccess } from "../middlewares/hasAccess.js";

const router = express.Router();

// 🧾 Exportar transacciones a PDF por fecha
router.get("/caja/pdf", protect, hasAccess(["Fundador"]), exportarCajaPDF);

// 📝 Exportar notas clínicas a PDF por número de documento (QUERY - legacy)
router.get(
    "/notas/pdf",
    protect,
    hasAccess(["Fundador", "Profesional", "Asistente"]),
    exportarNotasClinicasPDF
);

// ✅ NUEVO: Exportar notas clínicas a PDF por número de documento (PARAMS)
router.get(
    "/notas/:numeroDocumento",
    protect,
    hasAccess(["Fundador", "Profesional", "Asistente"]),
    exportarNotasClinicasPDFPorParams
);

export default router;
