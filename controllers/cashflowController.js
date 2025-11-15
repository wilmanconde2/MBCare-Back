import Transaction from "../models/Transaction.js";
import CashRegister from "../models/CashRegister.js";
import { inicioDelDia, finDelDia } from "../config/timezone.js";
import {
    recalcularResumenDiario,
    recalcularConsolidadoMensual
} from "../utils/recalculoCaja.js";

/**
 * ➕ Crear ingreso o egreso
 * Fundador / Asistente → permitido
 */
export const crearTransaccion = async (req, res) => {
    try {
        const { tipo, descripcion, monto, metodoPago } = req.body;

        if (!tipo || !descripcion || monto === undefined) {
            return res.status(400).json({ message: "Todos los campos son obligatorios." });
        }

        if (!["Ingreso", "Egreso"].includes(tipo)) {
            return res.status(400).json({ message: "Tipo inválido." });
        }

        const hoyInicio = inicioDelDia();
        const hoyFin = finDelDia();

        const caja = await CashRegister.findOne({
            fecha: { $gte: hoyInicio, $lte: hoyFin },
            organizacion: req.user.organizacion,
            abierta: true,
        });

        if (!caja) {
            return res.status(400).json({ message: "No hay una caja abierta para hoy." });
        }

        const transaccion = await Transaction.create({
            tipo,
            descripcion,
            monto,
            metodoPago,
            caja: caja._id,
            profesional: req.user._id,
            organizacion: req.user.organizacion,
        });

        res.status(201).json({ message: "Transacción registrada exitosamente.", transaccion });
    } catch (error) {
        console.error("Error al crear transacción:", error);
        res.status(500).json({ message: "Error del servidor." });
    }
};

/**
 * 🔍 Listar transacciones por ID de caja
 */
export const listarPorCaja = async (req, res) => {
    try {
        const { cajaId } = req.params;

        const transacciones = await Transaction.find({
            caja: cajaId,
            organizacion: req.user.organizacion,
        }).sort({ createdAt: -1 });

        res.status(200).json({ transacciones });
    } catch (error) {
        console.error("Error al listar transacciones:", error);
        res.status(500).json({ message: "Error del servidor." });
    }
};

/**
 * 📆 Listar transacciones por fecha específica
 */
export const listarPorFecha = async (req, res) => {
    try {
        const { fecha } = req.query;

        if (!fecha) {
            return res.status(400).json({ message: "La fecha es obligatoria." });
        }

        const inicio = inicioDelDia(fecha);
        const fin = finDelDia(fecha);

        const transacciones = await Transaction.find({
            createdAt: { $gte: inicio, $lte: fin },
            organizacion: req.user.organizacion,
        }).sort({ createdAt: -1 });

        res.status(200).json({ transacciones });
    } catch (error) {
        console.error("Error al filtrar transacciones por fecha:", error);
        res.status(500).json({ message: "Error del servidor." });
    }
};

/**
 * 📝 Editar una transacción
 * SOLO Fundador puede editar
 */
export const editarTransaccion = async (req, res) => {
    try {
        if (req.user.rol !== "Fundador") {
            return res.status(403).json({ message: "Solo el Fundador puede editar transacciones." });
        }

        const { id } = req.params;
        const { descripcion, monto, metodoPago } = req.body;

        const transaccion = await Transaction.findById(id);
        if (!transaccion || transaccion.organizacion.toString() !== req.user.organizacion.toString()) {
            return res.status(404).json({ message: "Transacción no encontrada." });
        }

        transaccion.descripcion = descripcion || transaccion.descripcion;
        transaccion.monto = monto !== undefined ? monto : transaccion.monto;
        transaccion.metodoPago = metodoPago || transaccion.metodoPago;

        await transaccion.save();

        // 🔥 RE-CÁLCULO AUTOMÁTICO
        const fecha = transaccion.createdAt;
        await recalcularResumenDiario(fecha, req.user.organizacion);
        await recalcularConsolidadoMensual(fecha, req.user.organizacion);

        res.status(200).json({ message: "Transacción actualizada exitosamente.", transaccion });
    } catch (error) {
        console.error("Error al editar transacción:", error);
        res.status(500).json({ message: "Error del servidor." });
    }
};

/**
 * 🗑️ Eliminar una transacción
 * SOLO Fundador puede eliminar
 */
export const eliminarTransaccion = async (req, res) => {
    try {
        if (req.user.rol !== "Fundador") {
            return res.status(403).json({ message: "Solo el Fundador puede eliminar transacciones." });
        }

        const { id } = req.params;

        const transaccion = await Transaction.findById(id);
        if (!transaccion || transaccion.organizacion.toString() !== req.user.organizacion.toString()) {
            return res.status(404).json({ message: "Transacción no encontrada." });
        }

        const fecha = transaccion.createdAt;

        await transaccion.deleteOne();

        // 🔥 RE-CÁLCULO AUTOMÁTICO
        await recalcularResumenDiario(fecha, req.user.organizacion);
        await recalcularConsolidadoMensual(fecha, req.user.organizacion);

        res.status(200).json({ message: "Transacción eliminada exitosamente." });
    } catch (error) {
        console.error("Error al eliminar transacción:", error);
        res.status(500).json({ message: "Error del servidor." });
    }
};
