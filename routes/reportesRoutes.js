import express from "express";
import {
    exportarCajaPDF,
    exportarNotasClinicasPDF,
} from "../controllers/reportesController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { hasAccess } from "../middlewares/hasAccess.js";

const router = express.Router();

// 🧾 Exportar transacciones a PDF por fecha
router.get("/caja/pdf", protect, hasAccess(["Fundador"]), exportarCajaPDF);

// 📝 Exportar notas clínicas a PDF por número de documento
router.get("/notas/pdf", protect, hasAccess(["Fundador", "Profesional"]), exportarNotasClinicasPDF);

export default router;
