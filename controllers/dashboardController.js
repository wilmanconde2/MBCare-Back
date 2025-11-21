import Transaction from "../models/Transaction.js";
import CashRegister from "../models/CashRegister.js";
import ResumenCaja from "../models/ResumenCaja.js";
import Patient from "../models/Patient.js";
import Appointment from "../models/Appointment.js";
import Note from "../models/Note.js";

import moment from "moment-timezone";
import { inicioDelDia, finDelDia } from "../config/timezone.js";
import { auditar } from "../utils/auditar.js";
import { recalcularResumenDiario } from "../utils/recalculoCaja.js";

/**
 * 📊 Dashboard híbrido (Clínico + Financiero)
 * Fundador / Asistente → ven todo
 * Profesional / Lector → ven solo clínico
 */
export const obtenerDashboard = async (req, res) => {
    try {
        const rol = req.user.rol;
        const organizacionId = req.user.organizacion;

        // ============================
        // 1️⃣ PARTE CLÍNICA (todos los roles)
        // ============================
        const totalPacientes = await Patient.countDocuments({ organizacion: organizacionId });
        const totalCitas = await Appointment.countDocuments({ organizacion: organizacionId });
        const totalNotas = await Note.countDocuments({ organizacion: organizacionId });

        const dataClinica = {
            pacientes: totalPacientes,
            citas: totalCitas,
            notas: totalNotas,
            recordatorios: 0 // hasta que implementes este módulo
        };

        // ============================
        // 2️⃣ SI NO ES FUNDADOR / ASISTENTE → SOLO CLÍNICO
        // ============================
        if (!["Fundador", "Asistente"].includes(rol)) {
            return res.status(200).json({
                clinico: dataClinica,
                financiero: null
            });
        }

        // ============================
        // 3️⃣ PARTE FINANCIERA (solo Fundador y Asistente)
        // ============================
        const hoy = new Date();
        const inicioHoy = inicioDelDia(hoy);
        const finHoy = finDelDia(hoy);

        // Recalcular resumen del día
        await recalcularResumenDiario(inicioHoy, organizacionId);

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

        const totalCajasCerradas = await CashRegister.countDocuments({
            organizacion: organizacionId,
            abierta: false,
        });

        const hace7dias = moment()
            .tz("America/Bogota")
            .subtract(7, "days")
            .startOf("day")
            .toDate();

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

        const dataFinanciera = {
            hoy: {
                ingresos: totalIngresosHoy,
                egresos: totalEgresosHoy,
            },
            cajasCerradas: totalCajasCerradas,
            resumen7dias
        };

        // ============================
        // 4️⃣ AUDITORÍA
        // ============================
        await auditar(req, "CONSULTAR_DASHBOARD", {
            usuario: req.user.id,
            organizacion: req.user.organizacion
        });


        // ============================
        // 5️⃣ RESPUESTA FINAL
        // ============================
        return res.status(200).json({
            clinico: dataClinica,
            financiero: dataFinanciera
        });

    } catch (error) {
        console.error("Error en dashboard:", error);
        res.status(500).json({ message: "Error al obtener métricas del dashboard." });
    }
};
