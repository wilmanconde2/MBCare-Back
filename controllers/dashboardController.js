import Transaction from "../models/Transaction.js";
import CashRegister from "../models/CashRegister.js";
import ResumenCaja from "../models/ResumenCaja.js";
import moment from "moment-timezone";
import { inicioDelDia, finDelDia } from "../config/timezone.js";
import { auditar } from "../utils/auditar.js";
import { recalcularResumenDiario } from "../utils/recalculoCaja.js";   // ✔ NUEVO

/**
 * 📊 Obtener métricas generales para el dashboard
 * Fundador + Asistente
 * Profesional NO puede acceder
 */
export const obtenerDashboard = async (req, res) => {
    try {
        // Bloqueo interno para Postman/Insomnia
        if (req.user.rol === "Profesional") {
            return res.status(403).json({
                message: "No tienes permisos para acceder al dashboard financiero."
            });
        }

        const hoy = new Date();
        const inicioHoy = inicioDelDia(hoy);
        const finHoy = finDelDia(hoy);
        const organizacionId = req.user.organizacion;

        // ✔ Recalcular resumen del día antes de mostrar dashboard
        await recalcularResumenDiario(inicioHoy, organizacionId);

        // Transacciones del día
        const transaccionesHoy = await Transaction.find({
            createdAt: { $gte: inicioHoy, $lt: finHoy },
            organizacion: organizacionId,
        });

        const totalIngresosHoy = transaccionesHoy
            .filter(t => t.tipo === "Ingreso")
            .reduce((acc, t) => acc + t.monto, 0);

        const totalEgresosHoy = transaccionesHoy
            .filter(t => t.tipo === "Egreso")
            .reduce((acc, t) => acc + t.monto, 0);

        // Total cajas cerradas
        const totalCajasCerradas = await CashRegister.countDocuments({
            organizacion: organizacionId,
            abierta: false,
        });

        // Resumen últimos 7 días (ya recalculado)
        const hace7dias = moment().tz("America/Bogota").subtract(7, "days").startOf("day").toDate();
        const resumenesSemana = await ResumenCaja.find({
            fecha: { $gte: hace7dias },
            organizacion: organizacionId,
        }).sort({ fecha: 1 });

        const resumen7dias = resumenesSemana.map(r => ({
            fecha: r.fecha,
            ingresos: r.ingresosTotales,
            egresos: r.egresosTotales,
            saldo: r.saldoFinal,
        }));

        // Auditoría
        await auditar(req, "CONSULTAR_DASHBOARD", {
            usuario: req.user._id,
            organizacion: req.user.organizacion
        });

        res.status(200).json({
            hoy: {
                ingresos: totalIngresosHoy,
                egresos: totalEgresosHoy,
            },
            cajasCerradas: totalCajasCerradas,
            resumen7dias,
        });

    } catch (error) {
        console.error("Error en dashboard:", error);
        res.status(500).json({ message: "Error al obtener métricas del dashboard." });
    }
};
