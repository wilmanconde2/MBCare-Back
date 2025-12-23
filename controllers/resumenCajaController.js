import ResumenCaja from "../models/ResumenCaja.js";
import Transaction from "../models/Transaction.js";
import CashRegister from "../models/CashRegister.js";
import { inicioDelDia, finDelDia } from "../config/timezone.js";
import { recalcularResumenDiario } from "../utils/recalculoCaja.js";

/* ========================================================================
   📊 Generar y guardar resumen diario de caja
   Fundador → permitido
   Asistente → permitido
   Profesional → PROHIBIDO
========================================================================= */
export const generarResumen = async (req, res) => {
    try {
        if (req.user.rol === "Profesional") {
            return res.status(403).json({
                message: "No tienes permisos para generar resúmenes de caja."
            });
        }

        const { fecha } = req.query;
        if (!fecha) {
            return res.status(400).json({ message: "La fecha es obligatoria." });
        }

        const inicioDia = inicioDelDia(fecha);
        const finDia = finDelDia(fecha);

        // Buscar caja del día (por organización)
        const caja = await CashRegister.findOne({
            fecha: { $gte: inicioDia, $lte: finDia },
            organizacion: req.user.organizacion,
        }).select("_id fecha saldoInicial saldoFinal abierta organizacion profesional");

        if (!caja) {
            return res.status(404).json({ message: "No se encontró caja para esa fecha." });
        }

        let resumenExistente = await ResumenCaja.findOne({
            fecha: inicioDia,
            organizacion: req.user.organizacion,
        });

        if (resumenExistente) {
            return res.status(200).json({
                message: "Resumen ya existente.",
                resumen: resumenExistente,
                caja,
            });
        }

        const saldoInicial = caja.saldoInicial || 0;

        const transacciones = await Transaction.find({
            createdAt: { $gte: inicioDia, $lte: finDia },
            organizacion: req.user.organizacion,
        });

        const ingresosTotales = transacciones
            .filter(t => t.tipo === "Ingreso")
            .reduce((sum, t) => sum + t.monto, 0);

        const egresosTotales = transacciones
            .filter(t => t.tipo === "Egreso")
            .reduce((sum, t) => sum + t.monto, 0);

        const saldoFinal = saldoInicial + ingresosTotales - egresosTotales;

        const resumen = await ResumenCaja.create({
            fecha: inicioDia,
            organizacion: req.user.organizacion,
            ingresosTotales,
            egresosTotales,
            saldoInicial,
            saldoFinal,
            creadoPor: req.user._id,
        });

        // ✔ Recalcular después de crear
        await recalcularResumenDiario(inicioDia, req.user.organizacion);

        return res.status(201).json({
            message: "Resumen generado exitosamente.",
            resumen,
            caja,
        });
    } catch (error) {
        console.error("Error al generar resumen:", error);
        return res.status(500).json({ message: "Error al generar resumen de caja." });
    }
};

/* ========================================================================
   📋 Consultar resumen diario por fecha
   - Devuelve también el estado de la caja (abierta/cerrada)
   - Si no existe resumen aún, calcula uno en memoria para renderizar UI
========================================================================= */
export const consultarResumen = async (req, res) => {
    try {
        if (req.user.rol === "Profesional") {
            return res.status(403).json({
                message: "No tienes permisos para consultar resúmenes de caja."
            });
        }

        const { fecha } = req.query;
        if (!fecha) {
            return res.status(400).json({ message: "La fecha es obligatoria." });
        }

        const inicioDia = inicioDelDia(fecha);
        const finDia = finDelDia(fecha);

        // Buscar caja del día (por organización)
        const caja = await CashRegister.findOne({
            fecha: { $gte: inicioDia, $lte: finDia },
            organizacion: req.user.organizacion,
        }).select("_id fecha saldoInicial saldoFinal abierta organizacion profesional");

        if (!caja) {
            return res.status(404).json({ message: "No se encontró caja para esa fecha." });
        }

        // ✔ Intentar recalcular antes de devolver (si tu util crea/actualiza)
        await recalcularResumenDiario(inicioDia, req.user.organizacion);

        let resumen = await ResumenCaja.findOne({
            fecha: inicioDia,
            organizacion: req.user.organizacion,
        });

        // Si todavía no existe resumen, lo calculamos en memoria (sin guardar)
        if (!resumen) {
            const transacciones = await Transaction.find({
                createdAt: { $gte: inicioDia, $lte: finDia },
                organizacion: req.user.organizacion,
            });

            const ingresosTotales = transacciones
                .filter(t => t.tipo === "Ingreso")
                .reduce((sum, t) => sum + t.monto, 0);

            const egresosTotales = transacciones
                .filter(t => t.tipo === "Egreso")
                .reduce((sum, t) => sum + t.monto, 0);

            const saldoInicial = caja.saldoInicial || 0;
            const saldoFinal = saldoInicial + ingresosTotales - egresosTotales;

            resumen = {
                fecha: inicioDia,
                organizacion: req.user.organizacion,
                ingresosTotales,
                egresosTotales,
                saldoInicial,
                saldoFinal,
            };
        }

        return res.status(200).json({ resumen, caja });
    } catch (error) {
        console.error("Error al consultar resumen:", error);
        return res.status(500).json({ message: "Error al consultar resumen de caja." });
    }
};
