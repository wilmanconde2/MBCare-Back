import ResumenCaja from "../models/ResumenCaja.js";
import Transaction from "../models/Transaction.js";
import CashRegister from "../models/CashRegister.js";
import { inicioDelDia, finDelDia } from "../config/timezone.js";
import { recalcularTodo } from "../utils/recalculoCaja.js";

export const generarResumen = async (req, res) => {
    try {
        if (req.user.rol === "Profesional") {
            return res.status(403).json({
                message: "No tienes permisos para generar resúmenes de caja.",
            });
        }

        const { fecha } = req.query;
        if (!fecha) {
            return res.status(400).json({ message: "La fecha es obligatoria." });
        }

        // ✅ FIX: businessDate consistente con el modelo ResumenCaja (YYYY-MM-DD)
        const businessDate = fecha;

        const inicioDia = inicioDelDia(businessDate);
        const finDia = finDelDia(inicioDia);

        const caja = await CashRegister.findOne({
            fecha: { $gte: inicioDia, $lte: finDia },
            organizacion: req.user.organizacion,
        }).select("_id fecha saldoInicial saldoFinal abierta organizacion profesional");

        // ✅ FIX: no devolver 404 en consulta válida (respuesta limpia para el front)
        if (!caja) {
            return res.status(200).json({
                message: "No se encontró caja para esa fecha.",
                resumen: null,
                caja: null,
            });
        }

        // ✅ FIX: buscar por (organizacion + businessDate) como define el modelo
        let resumenExistente = await ResumenCaja.findOne({
            businessDate,
            organizacion: req.user.organizacion,
        });

        if (resumenExistente) {
            return res.status(200).json({
                message: "Resumen ya existente.",
                resumen: resumenExistente,
                caja,
            });
        }

        const saldoInicial = Number(caja.saldoInicial) || 0;

        const transacciones = await Transaction.find({
            createdAt: { $gte: inicioDia, $lte: finDia },
            organizacion: req.user.organizacion,
        });

        const ingresosTotales = transacciones
            .filter((t) => t.tipo === "Ingreso")
            .reduce((sum, t) => sum + (Number(t.monto) || 0), 0);

        const egresosTotales = transacciones
            .filter((t) => t.tipo === "Egreso")
            .reduce((sum, t) => sum + (Number(t.monto) || 0), 0);

        const saldoFinal = saldoInicial + ingresosTotales - egresosTotales;

        // ✅ FIX: incluir businessDate y timezone (requeridos/consistentes con el modelo)
        const resumen = await ResumenCaja.create({
            businessDate,
            timezone: "America/Bogota",
            fecha: inicioDia, // compat con tu lógica actual (inicio del día)
            organizacion: req.user.organizacion,
            ingresosTotales,
            egresosTotales,
            saldoInicial,
            saldoFinal,
            creadoPor: req.user?._id || req.user?.id,
        });

        const userId = req.user?._id || req.user?.id;
        await recalcularTodo(inicioDia, req.user.organizacion, userId);

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

export const consultarResumen = async (req, res) => {
    try {
        if (req.user.rol === "Profesional") {
            return res.status(403).json({
                message: "No tienes permisos para consultar resúmenes de caja.",
            });
        }

        const { fecha } = req.query;
        if (!fecha) {
            return res.status(400).json({ message: "La fecha es obligatoria." });
        }

        // ✅ FIX: businessDate consistente con el modelo ResumenCaja (YYYY-MM-DD)
        const businessDate = fecha;

        const inicioDia = inicioDelDia(businessDate);
        const finDia = finDelDia(inicioDia);

        const caja = await CashRegister.findOne({
            fecha: { $gte: inicioDia, $lte: finDia },
            organizacion: req.user.organizacion,
        }).select("_id fecha saldoInicial saldoFinal abierta organizacion profesional");

        // ✅ FIX: no devolver 404 en consulta válida (así el front no “rompe” al cargar)
        if (!caja) {
            return res.status(200).json({
                resumen: null,
                caja: null,
            });
        }

        const userId = req.user?._id || req.user?.id;
        await recalcularTodo(inicioDia, req.user.organizacion, userId);

        // ✅ FIX: buscar por (organizacion + businessDate)
        let resumen = await ResumenCaja.findOne({
            businessDate,
            organizacion: req.user.organizacion,
        });

        // ✅ FIX: si no hay resumen persistido, responder 200 con resumen null (y caja presente)
        if (!resumen) {
            return res.status(200).json({
                resumen: null,
                caja,
            });
        }

        return res.status(200).json({ resumen, caja });
    } catch (error) {
        console.error("Error al consultar resumen:", error);
        return res.status(500).json({ message: "Error al consultar resumen de caja." });
    }
};
