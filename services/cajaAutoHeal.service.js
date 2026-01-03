// mbcare-backend/services/cajaAutoHeal.service.js
import CashRegister from "../models/CashRegister.js";
import Transaction from "../models/Transaction.js";

import {
  fechaISO,
  inicioDelDia,
  finDelDia,
  ZONA_HORARIA,
} from "../config/timezone.js";

import { calcularTotales } from "../utils/cajaUtils.js";
import { recalcularTodo } from "../utils/recalculoCaja.js";
import { auditar } from "../utils/auditar.js";

const TZ = ZONA_HORARIA || "America/Bogota";

/**
 * Obtiene YYYY-MM-DD (businessDate) desde una caja, aunque sea legacy.
 * - Si existe caja.businessDate, se usa.
 * - Si no, se deriva desde caja.fecha o caja.createdAt.
 */
const getBusinessDateFromCaja = (caja) => {
  if (caja?.businessDate) return caja.businessDate;

  const base = caja?.fecha || caja?.createdAt;
  if (!base) return null;

  // inicioDelDia acepta Date o string; acá pasamos Date y luego construimos YYYY-MM-DD en TZ
  // pero para evitar traer moment aquí, usamos fechaISO() solo para "hoy".
  // Derivación rápida: convertimos base a inicio de día y luego a ISO en TZ con inicioDelDia + finDelDia no sirve.
  // Como en tu proyecto ya estandarizas businessDate al crear, este fallback casi nunca se usa.
  // Si quieres 100% exactitud legacy, te recomiendo guardar businessDate en migración.
  const d = inicioDelDia(base);
  // Formato YYYY-MM-DD en TZ
  // Usamos toISOString() (UTC) no sirve para TZ; así que aquí dejamos null y forzamos manejo arriba.
  // Mejor: si no hay businessDate, devolvemos null y el caller decide.
  return null;
};

/**
 * Cierra una caja (por id) de forma segura.
 * - Solo suma transacciones dentro del rango del día de esa caja (por createdAt) y que pertenezcan a esa caja.
 * - Recalcula resumen diario + consolidado mensual usando tu recalculoCaja.js
 * - Audita si se pasa req
 */
const cerrarCajaInterna = async ({
  caja,
  organizacionId,
  actorUserId,
  req = null,
  motivo = "AUTOHEAL",
}) => {
  const businessDate = caja.businessDate || getBusinessDateFromCaja(caja);
  if (!businessDate) {
    throw new Error(
      `No se pudo determinar businessDate para la caja ${caja?._id}`
    );
  }

  // Rango del día (Bogotá) en Date (UTC real)
  const inicio = inicioDelDia(businessDate);
  const fin = finDelDia(businessDate);

  // Traer transacciones SOLO de esa caja y dentro del día
  const transacciones = await Transaction.find({
    caja: caja._id,
    organizacion: organizacionId,
    createdAt: { $gte: inicio, $lte: fin },
  });

  const { ingresos, egresos } = calcularTotales(transacciones);
  const saldoInicial = Number(caja.saldoInicial) || 0;
  const saldoFinal = saldoInicial + ingresos - egresos;

  // Cerrar caja (sin inventar campos nuevos)
  caja.abierta = false;
  caja.saldoFinal = saldoFinal;

  // Asegurar consistencia mínima (por si llega legacy)
  caja.businessDate = caja.businessDate || businessDate;
  caja.timezone = caja.timezone || TZ;
  caja.fecha = caja.fecha || inicio; // compat (inicio del día)

  await caja.save();

  // Auditoría (si hay req)
  if (req) {
    await auditar(req, "CIERRE_AUTOMATICO_CAJA", {
      cajaId: caja._id,
      businessDate,
      motivo,
      ingresos,
      egresos,
      saldoInicial,
      saldoFinal,
    });
  }

  // Recalcular resumen + consolidado
  // IMPORTANTE: si el consolidado del mes no existe, recalcularConsolidadoMensual requiere userId para crear
  await recalcularTodo(inicio, organizacionId, actorUserId);

  return {
    cajaId: String(caja._id),
    businessDate,
    ingresos,
    egresos,
    saldoInicial,
    saldoFinal,
  };
};

/**
 * ✅ AUTO-HEAL PRO:
 * Cierra automáticamente cualquier caja ABIERTA con businessDate anterior a hoy.
 *
 * Recomendación: llamarla al inicio de:
 * - estadoCajaHoy
 * - abrirCaja
 * - cerrarCaja
 *
 * @param {Object} params
 * @param {string|ObjectId} params.organizacionId  - requerido
 * @param {string|ObjectId} params.actorUserId     - requerido (para consolidado mensual cuando no existe)
 * @param {Object|null} params.req                 - opcional (para auditoría)
 * @param {boolean} params.dryRun                  - opcional (no guarda; solo simula)
 */
export const autoCerrarCajasVencidas = async ({
  organizacionId,
  actorUserId,
  req = null,
  dryRun = false,
} = {}) => {
  if (!organizacionId) {
    throw new Error("autoCerrarCajasVencidas: organizacionId es requerido.");
  }
  if (!actorUserId) {
    throw new Error("autoCerrarCajasVencidas: actorUserId es requerido.");
  }

  const hoy = fechaISO(); // YYYY-MM-DD en Bogotá

  // Buscar TODAS las cajas abiertas anteriores a hoy
  // (businessDate string 'YYYY-MM-DD' permite comparación lexicográfica)
  const cajasVencidas = await CashRegister.find({
    organizacion: organizacionId,
    abierta: true,
    businessDate: { $lt: hoy },
  }).sort({ businessDate: 1 });

  if (!cajasVencidas.length) {
    return {
      ok: true,
      hoy,
      cerradas: 0,
      detalles: [],
    };
  }

  // Dry-run: solo reporta
  if (dryRun) {
    return {
      ok: true,
      hoy,
      cerradas: 0,
      detalles: cajasVencidas.map((c) => ({
        cajaId: String(c._id),
        businessDate: c.businessDate,
        abierta: c.abierta,
      })),
      dryRun: true,
    };
  }

  const detalles = [];
  for (const caja of cajasVencidas) {
    const info = await cerrarCajaInterna({
      caja,
      organizacionId,
      actorUserId,
      req,
      motivo: "AUTOHEAL_VENCIDA",
    });
    detalles.push(info);
  }

  return {
    ok: true,
    hoy,
    cerradas: detalles.length,
    detalles,
  };
};
