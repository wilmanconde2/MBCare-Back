import ResumenCaja from "../models/ResumenCaja.js";
import Transaction from "../models/Transaction.js";
import CashRegister from "../models/CashRegister.js";
import { inicioDelDia, finDelDia } from "../config/timezone.js";

/**
 * 📊 Generar y guardar resumen diario de caja
 * Si ya existe para ese día, lo devuelve sin recalcular
 */
export const generarResumen = async (req, res) => {
    try {
        const { fecha } = req.query;

        if (!fecha) {
            return res.status(400).json({ message: "La fecha es obligatoria." });
        }

        const inicioDia = inicioDelDia(fecha);
        const finDia = finDelDia(fecha);

        // Verificar si ya existe resumen
        let resumenExistente = await ResumenCaja.findOne({
            fecha: inicioDia,
            organizacion: req.user.organizacion,
        });

        if (resumenExistente) {
            return res.status(200).json({
                message: "Resumen ya existente.",
                resumen: resumenExistente,
            });
        }

        // Traer caja del día
        const caja = await CashRegister.findOne({
            fecha: { $gte: inicioDia, $lte: finDia },
            organizacion: req.user.organizacion,
        });

        if (!caja) {
            return res.status(404).json({ message: "No se encontró caja para esa fecha." });
        }

        const saldoInicial = caja.saldoInicial || 0;

        // Transacciones del día
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

        // Crear resumen
        const resumen = await ResumenCaja.create({
            fecha: inicioDia,
            organizacion: req.user.organizacion,
            ingresosTotales,
            egresosTotales,
            saldoInicial,
            saldoFinal,
            creadoPor: req.user._id,
        });

        res.status(201).json({
            message: "Resumen generado exitosamente.",
            resumen,
        });
    } catch (error) {
        console.error("Error al generar resumen:", error);
        res.status(500).json({ message: "Error al generar resumen de caja." });
    }
};

/**
 * 📋 Consultar resumen diario por fecha (sin generar uno nuevo)
 */
export const consultarResumen = async (req, res) => {
    try {
        const { fecha } = req.query;

        if (!fecha) {
            return res.status(400).json({ message: "La fecha es obligatoria." });
        }

        const inicioDia = inicioDelDia(fecha);

        const resumen = await ResumenCaja.findOne({
            fecha: inicioDia,
            organizacion: req.user.organizacion,
        });

        if (!resumen) {
            return res.status(404).json({ message: "No se encontró resumen para esa fecha." });
        }

        res.status(200).json({ resumen });
    } catch (error) {
        console.error("Error al consultar resumen:", error);
        res.status(500).json({ message: "Error al consultar resumen de caja." });
    }
};
