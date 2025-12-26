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

// Crear ingreso/egreso: Fundador + Asistente
router.post("/crear", protect, hasAccess(["Fundador", "Asistente"]), crearTransaccion);

// Listar transacciones por caja: Fundador + Asistente
router.get("/transacciones/caja/:cajaId", protect, hasAccess(["Fundador", "Asistente"]), listarPorCaja);

// Listar por fecha: Fundador + Asistente
router.get("/transacciones/fecha", protect, hasAccess(["Fundador", "Asistente"]), listarPorFecha);

// Editar transacción: SOLO Fundador
router.put("/transaccion/:id", protect, hasAccess(["Fundador"]), editarTransaccion);

// Eliminar transacción: SOLO Fundador
router.delete("/transaccion/:id", protect, hasAccess(["Fundador"]), eliminarTransaccion);

export default router;
