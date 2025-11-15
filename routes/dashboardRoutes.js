import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { hasAccess } from "../middlewares/hasAccess.js";
import { obtenerDashboard } from "../controllers/dashboardController.js";

const router = express.Router();

// 📊 Ruta protegida para obtener dashboard de métricas
router.get("/", protect, hasAccess(["Fundador"]), obtenerDashboard);

export default router;
