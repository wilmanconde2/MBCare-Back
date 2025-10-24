import express from "express";
import { crearUsuarioPorRol } from "../controllers/organizationController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { hasAccess } from "../middlewares/hasAccess.js";

const router = express.Router();

// Fundador crea usuarios con rol Profesional o Asistente
router.post(
    "/crear-usuario",
    protect,
    hasAccess("Fundador"),
    crearUsuarioPorRol
);

export default router;
