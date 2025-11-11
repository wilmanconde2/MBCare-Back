import express from "express";
import { generarResumen, consultarResumen } from "../controllers/resumenCajaController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { hasAccess } from "../middlewares/hasAccess.js";

const router = express.Router();

// 🧮 Generar resumen diario
router.get("/generar", protect, hasAccess("Fundador"), generarResumen);

// 📋 Consultar resumen diario ya generado
router.get("/", protect, hasAccess("Fundador"), consultarResumen);

export default router;
