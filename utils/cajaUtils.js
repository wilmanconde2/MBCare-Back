import Transaction from "../models/Transaction.js";
import ResumenCaja from "../models/ResumenCaja.js";
import { inicioDelDia, finDelDia } from "../config/timezone.js";
import moment from "moment-timezone";

const TZ = "America/Bogota";

/* ===============================
   Identidad / fechas
================================ */

export const getProfesionalId = (req) => req.user?._id || req.user?.id;

export const getRangoDia = (fecha) => {
    const inicio = inicioDelDia(fecha);
    const fin = finDelDia(inicio);
    return { inicio, fin };
};

export const getRangoHoy = () => getRangoDia();

/* ===============================
   Totales
================================ */

export const calcularTotales = (transacciones = []) => {
    const ingresos = (transacciones || [])
        .filter((t) => t.tipo === "Ingreso")
        .reduce((acc, t) => acc + (Number(t.monto) || 0), 0);

    const egresos = (transacciones || [])
        .filter((t) => t.tipo === "Egreso")
        .reduce((acc, t) => acc + (Number(t.monto) || 0), 0);

    return { ingresos, egresos };
};

/* ===============================
   Normalización
================================ */

export const normalizarDescripcion = (t) =>
    t.descripcion || t.detalle || t.concepto || t.motivo || t.notas || "Sin descripción";

export const normalizarMetodo = (t) =>
    t.metodo || t.metodoPago || t.formaPago || t.medioPago || "N/A";

/**
 * ✅ FIX:
 * - Patient real field: nombreCompleto
 * - soporta fallback si llega string (id) o si viene como { nombreCompleto }
 * - soporta pacienteNombre legacy
 */
export const normalizarPaciente = (t) => {
    const p = t?.paciente;

    // Si paciente es null/undefined
    if (!p) return t?.pacienteNombre || null;

    // Si por alguna razón viene como string (ObjectId sin populate)
    if (typeof p === "string") return t?.pacienteNombre || null;

    // Populate correcto
    const nombre =
        p.nombreCompleto ||
        p.nombre ||
        p.fullName ||
        p.name ||
        null;

    // opcional: si quieres mostrar documento en el PDF
    // const doc = p.numeroDocumento ? ` (${p.numeroDocumento})` : "";
    // return nombre ? `${nombre}${doc}` : (t?.pacienteNombre || null);

    return nombre || (t?.pacienteNombre || null);
};

export const formatearTransaccion = (t) => ({
    _id: t._id,
    hora: t.createdAt ? moment(t.createdAt).tz(TZ).format("HH:mm") : "",
    descripcion: normalizarDescripcion(t),
    metodo: normalizarMetodo(t),
    tipo: t.tipo,
    monto: Number(t.monto) || 0,
    paciente: normalizarPaciente(t),
    createdAt: t.createdAt,
});

/* ===============================
   Transacciones (caja / fallback día)
   - Primero busca por cajaId
   - Si no hay, fallback por rango del día
================================ */

export const obtenerTransaccionesDeCajaOFecha = async ({
    organizacionId,
    cajaId,
    fecha,
    populatePaciente = true,
}) => {
    let query = Transaction.find({
        caja: cajaId,
        organizacion: organizacionId,
    }).sort({ createdAt: 1 });

    // ✅ Recomendado: traer también numeroDocumento si lo quieres mostrar
    if (populatePaciente) query = query.populate("paciente", "nombreCompleto numeroDocumento");

    let transacciones = await query;

    if (!transacciones || transacciones.length === 0) {
        const { inicio, fin } = getRangoDia(fecha);

        let q2 = Transaction.find({
            organizacion: organizacionId,
            createdAt: { $gte: inicio, $lte: fin },
        }).sort({ createdAt: 1 });

        if (populatePaciente) q2 = q2.populate("paciente", "nombreCompleto numeroDocumento");

        transacciones = await q2;
    }

    return transacciones || [];
};

/* ===============================
   Resumen oficial o derivado
================================ */

export const obtenerResumenOficialODerivado = async ({
    organizacionId,
    fechaClave,
    cajaSaldoInicial,
    ingresosCalc,
    egresosCalc,
}) => {
    const fechaNormalizada = inicioDelDia(fechaClave);

    const resumenExistente = await ResumenCaja.findOne({
        fecha: fechaNormalizada,
        organizacion: organizacionId,
    });

    const ingresosNum = Number(ingresosCalc) || 0;
    const egresosNum = Number(egresosCalc) || 0;

    const saldoInicial = Number(resumenExistente?.saldoInicial ?? cajaSaldoInicial ?? 0) || 0;
    const saldoFinalDerivado = saldoInicial + ingresosNum - egresosNum;

    return {
        resumenExistente,
        resumen: {
            ingresosTotales: resumenExistente
                ? Number(resumenExistente.ingresosTotales) || 0
                : ingresosNum,
            egresosTotales: resumenExistente
                ? Number(resumenExistente.egresosTotales) || 0
                : egresosNum,
            saldoInicial,
            saldoFinal: resumenExistente
                ? Number(resumenExistente.saldoFinal) || 0
                : saldoFinalDerivado,
        },
    };
};
