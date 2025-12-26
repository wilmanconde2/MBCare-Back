import Transaction from "../models/Transaction.js";
import CashRegister from "../models/CashRegister.js";
import { inicioDelDia, finDelDia } from "../config/timezone.js";
import { recalcularResumenDiario } from "../utils/recalculoCaja.js";

/**
 * ➕ Crear ingreso o egreso
 * Fundador / Asistente
 *
 * Regla del sistema:
 * - Al crear/editar/eliminar: recalcular SOLO diario (ResumenCaja + saldoFinal de caja).
 * - Mensual: SOLO al cerrar caja (cajaController).
 */
export const crearTransaccion = async (req, res) => {
    try {
        const { tipo, descripcion, monto, metodoPago, categoria, paciente } = req.body;

        const userId = req.user?._id || req.user?.id;
        const orgId = req.user?.organizacion;

        if (!userId) {
            return res.status(401).json({ message: "Usuario no autenticado." });
        }

        if (!orgId) {
            return res.status(400).json({ message: "Organización no encontrada en el token." });
        }

        if (!tipo || !descripcion || monto === undefined) {
            return res.status(400).json({ message: "Tipo, descripción y monto son obligatorios." });
        }

        if (!["Ingreso", "Egreso"].includes(tipo)) {
            return res.status(400).json({ message: "Tipo inválido." });
        }

        const montoNum = Number(monto);
        if (!Number.isFinite(montoNum) || montoNum < 0) {
            return res.status(400).json({ message: "Monto inválido." });
        }

        const hoyInicio = inicioDelDia();
        const hoyFin = finDelDia(hoyInicio);

        const caja = await CashRegister.findOne({
            fecha: { $gte: hoyInicio, $lte: hoyFin },
            organizacion: orgId,
            abierta: true,
        });

        if (!caja) {
            return res.status(400).json({ message: "No hay una caja abierta para hoy." });
        }

        const transaccion = await Transaction.create({
            tipo,
            descripcion,
            monto: montoNum,
            metodoPago,
            categoria: categoria || null,
            paciente: paciente || null,
            caja: caja._id,
            profesional: userId,
            organizacion: orgId,
        });

        // ✅ Recalcular SOLO diario (mensual NO aquí)
        try {
            await recalcularResumenDiario(hoyInicio, orgId);
        } catch (e) {
            console.error("Error recalculando resumen diario (crearTransaccion):", e);
        }

        return res.status(201).json({
            message: "Transacción registrada exitosamente.",
            transaccion,
        });
    } catch (error) {
        console.error("Error al crear transacción:", error);
        return res.status(500).json({ message: "Error del servidor." });
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
        })
            .populate("paciente", "nombreCompleto numeroDocumento")
            .sort({ createdAt: -1 });

        return res.status(200).json({ transacciones });
    } catch (error) {
        console.error("Error al listar transacciones:", error);
        return res.status(500).json({ message: "Error del servidor." });
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
        const fin = finDelDia(inicio);

        const transacciones = await Transaction.find({
            createdAt: { $gte: inicio, $lte: fin },
            organizacion: req.user.organizacion,
        })
            .populate("paciente", "nombreCompleto numeroDocumento")
            .sort({ createdAt: -1 });

        return res.status(200).json({ transacciones });
    } catch (error) {
        console.error("Error al filtrar transacciones por fecha:", error);
        return res.status(500).json({ message: "Error del servidor." });
    }
};

/**
 * 📝 Editar una transacción
 * Solo Fundador
 */
export const editarTransaccion = async (req, res) => {
    try {
        if (req.user.rol !== "Fundador") {
            return res.status(403).json({ message: "Solo el Fundador puede editar transacciones." });
        }

        const { id } = req.params;
        const { descripcion, monto, metodoPago, categoria, paciente } = req.body;

        const transaccion = await Transaction.findById(id);

        if (!transaccion || transaccion.organizacion.toString() !== req.user.organizacion.toString()) {
            return res.status(404).json({ message: "Transacción no encontrada." });
        }

        if (descripcion !== undefined) transaccion.descripcion = descripcion;

        if (monto !== undefined) {
            const montoNum = Number(monto);
            if (!Number.isFinite(montoNum) || montoNum < 0) {
                return res.status(400).json({ message: "Monto inválido." });
            }
            transaccion.monto = montoNum;
        }

        if (metodoPago !== undefined) transaccion.metodoPago = metodoPago;
        if (categoria !== undefined) transaccion.categoria = categoria;
        if (paciente !== undefined) transaccion.paciente = paciente || null;

        await transaccion.save();

        // ✅ Recalcular SOLO diario (fecha del día de la transacción)
        const fechaClave = inicioDelDia(transaccion.createdAt);
        try {
            await recalcularResumenDiario(fechaClave, req.user.organizacion);
        } catch (e) {
            console.error("Error recalculando resumen diario (editarTransaccion):", e);
        }

        return res.status(200).json({
            message: "Transacción actualizada exitosamente.",
            transaccion,
        });
    } catch (error) {
        console.error("Error al editar transacción:", error);
        return res.status(500).json({ message: "Error del servidor." });
    }
};

/**
 * 🗑️ Eliminar una transacción
 * Solo Fundador
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

        const fechaClave = inicioDelDia(transaccion.createdAt);

        await transaccion.deleteOne();

        // ✅ Recalcular SOLO diario (para el día afectado)
        try {
            await recalcularResumenDiario(fechaClave, req.user.organizacion);
        } catch (e) {
            console.error("Error recalculando resumen diario (eliminarTransaccion):", e);
        }

        return res.status(200).json({ message: "Transacción eliminada exitosamente." });
    } catch (error) {
        console.error("Error al eliminar transacción:", error);
        return res.status(500).json({ message: "Error del servidor." });
    }
};
