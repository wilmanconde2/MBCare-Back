import Transaction from "../models/Transaction.js";
import CashRegister from "../models/CashRegister.js";
import ResumenCaja from "../models/ResumenCaja.js";
import moment from "moment-timezone";
import { inicioDelDia, finDelDia } from "../config/timezone.js";
import { auditar } from "../utils/auditar.js";

// 📊 Obtener métricas generales para el dashboard
export const obtenerDashboard = async (req, res) => {
    try {
        const hoy = new Date();
        const inicioHoy = inicioDelDia(hoy);
        const finHoy = finDelDia(hoy);

        const organizacionId = req.user.organizacion;

        // Ingresos y egresos de hoy
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

        // Cajas cerradas históricas
        const totalCajasCerradas = await CashRegister.countDocuments({
            organizacion: organizacionId,
            abierta: false,
        });

        // Resumen de últimos 7 días
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

        // 🟦 Auditoría
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
