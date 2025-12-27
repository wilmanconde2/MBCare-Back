import ResumenCaja from "../models/ResumenCaja.js";
import ConsolidadoMensual from "../models/ConsolidadoMensual.js";
import Transaction from "../models/Transaction.js";
import CashRegister from "../models/CashRegister.js";
import moment from "moment-timezone";
import { inicioDelDia, finDelDia } from "../config/timezone.js";

const TZ = "America/Bogota";

const normalizarFecha = (fecha) => inicioDelDia(fecha);

export const recalcularResumenDiario = async (fecha, organizacionId) => {
    try {
        const fechaInicio = normalizarFecha(fecha);
        const fechaFin = finDelDia(fechaInicio);

        const caja = await CashRegister.findOne({
            fecha: { $gte: fechaInicio, $lte: fechaFin },
            organizacion: organizacionId,
        });

        if (!caja) return null;

        const transacciones = await Transaction.find({
            createdAt: { $gte: fechaInicio, $lte: fechaFin },
            organizacion: organizacionId,
        });

        const ingresosTotales = transacciones
            .filter((t) => t.tipo === "Ingreso")
            .reduce((a, t) => a + (Number(t.monto) || 0), 0);

        const egresosTotales = transacciones
            .filter((t) => t.tipo === "Egreso")
            .reduce((a, t) => a + (Number(t.monto) || 0), 0);

        const saldoInicial = Number(caja.saldoInicial) || 0;
        const saldoFinal = saldoInicial + ingresosTotales - egresosTotales;

        caja.saldoFinal = saldoFinal;
        await caja.save();

        let resumen = await ResumenCaja.findOne({
            fecha: fechaInicio,
            organizacion: organizacionId,
        });

        if (resumen) {
            resumen.ingresosTotales = ingresosTotales;
            resumen.egresosTotales = egresosTotales;
            resumen.saldoInicial = saldoInicial;
            resumen.saldoFinal = saldoFinal;
            await resumen.save();
        } else {
            resumen = await ResumenCaja.create({
                fecha: fechaInicio,
                organizacion: organizacionId,
                ingresosTotales,
                egresosTotales,
                saldoInicial,
                saldoFinal,
            });
        }

        return resumen;
    } catch (err) {
        console.error("Error en recalcularResumenDiario:", err);
        return null;
    }
};

export const recalcularConsolidadoMensual = async (fecha, organizacionId, userId = null) => {
    try {
        const f = moment(fecha).tz(TZ);
        const anio = f.year();
        const mes = f.month() + 1;

        const inicioMes = f.clone().startOf("month").toDate();
        const finMes = f.clone().endOf("month").toDate();

        const resumenes = await ResumenCaja.find({
            fecha: { $gte: inicioMes, $lte: finMes },
            organizacion: organizacionId,
        }).sort({ fecha: 1 });

        const ingresosTotales = resumenes.reduce(
            (a, r) => a + (Number(r.ingresosTotales) || 0),
            0
        );

        const egresosTotales = resumenes.reduce(
            (a, r) => a + (Number(r.egresosTotales) || 0),
            0
        );

        const saldoInicial = resumenes.length > 0 ? (Number(resumenes[0].saldoInicial) || 0) : 0;
        const saldoFinal = saldoInicial + ingresosTotales - egresosTotales;

        let consolidado = await ConsolidadoMensual.findOne({
            mes,
            anio,
            organizacion: organizacionId,
        });

        if (consolidado) {
            consolidado.ingresosTotales = ingresosTotales;
            consolidado.egresosTotales = egresosTotales;
            consolidado.saldoInicial = saldoInicial;
            consolidado.saldoFinal = saldoFinal;
            consolidado.ultimaActualizacion = new Date();
            await consolidado.save();
            return consolidado;
        }

        if (!userId) {
            throw new Error("No se puede crear consolidado mensual sin userId (creadoPor requerido).");
        }

        consolidado = await ConsolidadoMensual.create({
            mes,
            anio,
            organizacion: organizacionId,
            ingresosTotales,
            egresosTotales,
            saldoInicial,
            saldoFinal,
            creadoPor: userId,
            ultimaActualizacion: new Date(),
        });

        return consolidado;
    } catch (err) {
        console.error("Error en recalcularConsolidadoMensual:", err);
        return null;
    }
};

export const recalcularTodo = async (fecha, organizacionId, userId = null) => {
    const fechaClave = normalizarFecha(fecha);

    const resumen = await recalcularResumenDiario(fechaClave, organizacionId);
    const consolidado = await recalcularConsolidadoMensual(fechaClave, organizacionId, userId);

    return { resumen, consolidado };
};
