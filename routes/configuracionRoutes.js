import express from "express";
import { obtenerConfiguracion, actualizarConfiguracion } from "../controllers/configuracionController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/multer.js";
import { hasAccess } from "../middlewares/hasAccess.js";

const router = express.Router();

// Fundador, Profesional o Asistente pueden ver configuración básica
router.get("/", protect, obtenerConfiguracion);

// Solo Fundador puede actualizar configuración
router.put(
    "/",
    protect,
    hasAccess(["Fundador"]),
    upload.single("logo"),
    actualizarConfiguracion
);

export default router;
