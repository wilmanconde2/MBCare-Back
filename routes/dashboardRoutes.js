import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { obtenerDashboard } from "../controllers/dashboardController.js";

const router = express.Router();

// 📊 Ruta protegida para obtener dashboard de métricas
router.get("/", protect, obtenerDashboard);

export default router;
