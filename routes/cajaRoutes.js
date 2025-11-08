import express from "express";
import { abrirCaja } from "../controllers/cajaController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { hasAccess } from "../middlewares/hasAccess.js";

const router = express.Router();

// 👉 Abrir caja del día (solo Fundador o Asistente)
router.post("/abrir", protect, hasAccess(["Fundador", "Asistente"]), abrirCaja);

export default router;
