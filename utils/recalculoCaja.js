import ResumenCaja from "../models/ResumenCaja.js";
import ConsolidadoMensual from "../models/ConsolidadoMensual.js";
import Transaction from "../models/Transaction.js";
import CashRegister from "../models/CashRegister.js";
import moment from "moment-timezone";
import { inicioDelDia, finDelDia, ZONA_HORARIA } from "../config/timezone.js";

const TZ = ZONA_HORARIA || "America/Bogota";

const normalizarFecha = (fecha) => inicioDelDia(fecha);

/**
 * Calcula businessDate (YYYY-MM-DD) en TZ a partir de una fecha Date.
 */
const toBusinessDate = (fechaDate) => {
    return moment(fechaDate).tz(TZ).format("YYYY-MM-DD");
};

/**
 * Intenta encontrar caja del día:
 * 1) por businessDate (nuevo)
 * 2) fallback por rango de fecha (legacy)
 */
const findCajaDelDia = async ({ fechaInicio, fechaFin, organizacionId, businessDate }) => {
    let caja = await CashRegister.findOne({
        organizacion: organizacionId,
        businessDate,
    }).sort({ createdAt: -1 });

    if (!caja) {
        caja = await CashRegister.findOne({
            fecha: { $gte: fechaInicio, $lte: fechaFin },
            organizacion: organizacionId,
        }).sort({ createdAt: -1 });
    }

    return caja;
};

export const recalcularResumenDiario = async (fecha, organizacionId) => {
    try {
        const fechaInicio = normalizarFecha(fecha);
        const fechaFin = finDelDia(fechaInicio);

        const businessDate = toBusinessDate(fechaInicio);

        // 1) Caja del día (soporta legacy)
        const caja = await findCajaDelDia({
            fechaInicio,
            fechaFin,
            organizacionId,
            businessDate,
        });

        if (!caja) return null;

        // 2) Transacciones del día (por rango)
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

        // 3) ✅ Reparar caja legacy y persistir saldoFinal sin caer en validation por businessDate faltante
        //    Usamos updateOne para evitar caja.save() sobre docs viejos.
        await CashRegister.updateOne(
            { _id: caja._id },
            {
                $set: {
                    businessDate: caja.businessDate || businessDate,
                    timezone: caja.timezone || TZ,
                    // Mantener compat: fecha como inicio del día Bogotá (Date)
                    fecha: caja.fecha || fechaInicio,
                    saldoFinal,
                },
            }
        );

        // 4) ResumenCaja: prioridad por businessDate (índice unique), fallback por fecha (legacy)
        let resumen = await ResumenCaja.findOne({
            organizacion: organizacionId,
            businessDate,
        });

        if (!resumen) {
            // fallback legacy por fecha (si existe de antes sin businessDate)
            resumen = await ResumenCaja.findOne({
                organizacion: organizacionId,
                fecha: fechaInicio,
            });
        }

        if (resumen) {
            // Si era legacy sin businessDate, lo rellenamos y luego guardamos
            resumen.businessDate = resumen.businessDate || businessDate;
            resumen.timezone = resumen.timezone || TZ;

            resumen.ingresosTotales = ingresosTotales;
            resumen.egresosTotales = egresosTotales;
            resumen.saldoInicial = saldoInicial;
            resumen.saldoFinal = saldoFinal;
            resumen.fecha = resumen.fecha || fechaInicio;

            await resumen.save();
            return resumen;
        }

        // 5) Crear (upsert seguro) por businessDate
        resumen = await ResumenCaja.findOneAndUpdate(
            { organizacion: organizacionId, businessDate },
            {
                $set: {
                    businessDate,
                    timezone: TZ,
                    fecha: fechaInicio,
                    ingresosTotales,
                    egresosTotales,
                    saldoInicial,
                    saldoFinal,
                },
            },
            { upsert: true, new: true }
        );

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

        const ingresosTotales = resumenes.reduce((a, r) => a + (Number(r.ingresosTotales) || 0), 0);

        const egresosTotales = resumenes.reduce((a, r) => a + (Number(r.egresosTotales) || 0), 0);

        const saldoInicial = resumenes.length > 0 ? Number(resumenes[0].saldoInicial) || 0 : 0;
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
