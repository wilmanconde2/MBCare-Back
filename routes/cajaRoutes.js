import express from "express";
import { abrirCaja, cerrarCaja } from "../controllers/cajaController.js";
import { generarResumen } from "../controllers/resumenCajaController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { hasAccess } from "../middlewares/hasAccess.js";
import { historialCajas } from "../controllers/cajaController.js";
import { exportarHistorialCajaPDF } from "../controllers/cajaController.js";

const router = express.Router();

// 👉 Abrir caja del día (solo Fundador o Asistente)
router.post("/abrir", protect, hasAccess(["Fundador", "Asistente"]), abrirCaja);

// 🔒 Cerrar caja del día (Fundador o Asistente)
router.post("/cerrar", protect, hasAccess(["Fundador", "Asistente"]), cerrarCaja);

// 📊 Generar resumen diario de caja (Fundador)
router.get("/resumen", protect, hasAccess(["Fundador"]), generarResumen);

// 📜 Historial de cajas (Fundador o Asistente)
router.get("/historial", protect, hasAccess(["Fundador", "Asistente"]), historialCajas);
router.get("/historial/exportar", protect, hasAccess(["Fundador"]), exportarHistorialCajaPDF);


export default router;
