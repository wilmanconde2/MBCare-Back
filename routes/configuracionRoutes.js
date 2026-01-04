// mbcare-backend/routes/configuracionRoutes.js

import express from "express";
import {
    obtenerConfiguracion,
    actualizarNombreOrganizacion,
} from "../controllers/configuracionController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { hasAccess } from "../middlewares/hasAccess.js";

const router = express.Router();

/**
 * Ver configuración básica (todos los roles)
 */
router.get("/", protect, obtenerConfiguracion);

/**
 * Actualizar SOLO nombre de organización (solo Fundador)
 */
router.patch(
    "/organizacion/nombre",
    protect,
    hasAccess(["Fundador"]),
    actualizarNombreOrganizacion
);

export default router;
