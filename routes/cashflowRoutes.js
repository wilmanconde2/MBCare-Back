import express from "express";
import {
    crearTransaccion,
    listarPorCaja,
    listarPorFecha,
    editarTransaccion,
    eliminarTransaccion,
} from "../controllers/cashflowController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { hasAccess } from "../middlewares/hasAccess.js";

const router = express.Router();

// ➕ Crear ingreso o egreso (Fundador o Profesional)
router.post("/crear", protect, hasAccess(["Fundador", "Profesional"]), crearTransaccion);

// 🔍 Listar transacciones por ID de caja
router.get("/transacciones/caja/:cajaId", protect, hasAccess(["Fundador", "Profesional"]), listarPorCaja);

// 📆 Listar transacciones por fecha específica (query param)
router.get("/transacciones/fecha", protect, hasAccess(["Fundador", "Profesional"]), listarPorFecha);

// 📝 Editar transacción
router.put("/transaccion/:id", protect, hasAccess(["Fundador", "Profesional"]), editarTransaccion);

// 🗑️ Eliminar transacción
router.delete("/transaccion/:id", protect, hasAccess(["Fundador", "Profesional"]), eliminarTransaccion);

export default router;
