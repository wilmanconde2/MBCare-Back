import mongoose from "mongoose";

import Transaction from "../models/Transaction.js";
import CashRegister from "../models/CashRegister.js";

import { inicioDelDia, fechaISO, rangoUTCDesdeBusinessDate } from "../config/timezone.js";
import { recalcularTodo } from "../utils/recalculoCaja.js";
import { auditar } from "../utils/auditar.js";
import { formatearTransaccion } from "../utils/cajaUtils.js";

/**
 * Helper: obtener userId consistente
 */
const getUserId = (req) => req.user?._id || req.user?.id;

/**
 * Helper: validar si una fecha está dentro de rango [inicio, fin]
 */
const inRange = (d, inicio, fin) => {
  const t = new Date(d).getTime();
  return t >= new Date(inicio).getTime() && t <= new Date(fin).getTime();
};

/**
 * ✅ Crear ingreso/egreso (Fundador + Asistente)
 * Ruta: POST /api/flujo-caja/crear
 */
export const crearTransaccion = async (req, res) => {
  try {
    const organizacionId = req.user.organizacion;
    const profesionalId = getUserId(req);

    const { tipo, categoria, descripcion, monto, metodoPago, paciente } = req.body;

    if (!["Ingreso", "Egreso"].includes(tipo)) {
      return res.status(400).json({ message: "Tipo inválido. Usa Ingreso o Egreso." });
    }

    if (typeof descripcion !== "string" || !descripcion.trim()) {
      return res.status(400).json({ message: "Descripción inválida." });
    }

    const montoNumber = Number(monto);
    if (!Number.isFinite(montoNumber) || montoNumber <= 0) {
      return res.status(400).json({ message: "Monto inválido." });
    }

    // ✅ Caja ABIERTA de hoy por businessDate
    const businessDate = fechaISO();
    const caja = await CashRegister.findOne({
      organizacion: organizacionId,
      businessDate,
      abierta: true,
    });

    if (!caja) {
      return res.status(403).json({
        message: "No hay caja abierta hoy. Abre la caja para registrar movimientos.",
      });
    }

    const tx = await Transaction.create({
      tipo,
      categoria: (categoria ?? "").toString().trim(),
      descripcion: descripcion.trim(),
      monto: montoNumber,
      metodoPago,
      paciente: paciente || undefined,
      caja: caja._id,
      profesional: profesionalId,
      organizacion: organizacionId,
    });

    await auditar(req, "CREAR_TRANSACCION", {
      transaccionId: tx._id,
      tipo: tx.tipo,
      monto: tx.monto,
      cajaId: caja._id,
      businessDate,
    });

    // ✅ Recalcular día + consolidado mensual usando la "fecha clave" del día Bogotá
    const fechaClave = inicioDelDia(businessDate);
    await recalcularTodo(fechaClave, organizacionId, profesionalId);

    return res.status(201).json({
      message: "Transacción creada.",
      transaccion: tx,
    });
  } catch (error) {
    console.error("crearTransaccion:", error);
    return res.status(500).json({ message: "Error al crear transacción." });
  }
};

/**
 * ✅ Listar transacciones por caja (Fundador + Asistente)
 * Ruta: GET /api/flujo-caja/transacciones/caja/:cajaId
 */
export const listarPorCaja = async (req, res) => {
  try {
    const { cajaId } = req.params;
    const organizacionId = req.user.organizacion;

    if (!mongoose.Types.ObjectId.isValid(cajaId)) {
      return res.status(400).json({ message: "ID de caja inválido." });
    }

    const transacciones = await Transaction.find({
      caja: cajaId,
      organizacion: organizacionId,
    })
      .populate("paciente", "nombreCompleto numeroDocumento")
      .sort({ createdAt: 1 });

    return res.status(200).json({
      transacciones: transacciones.map(formatearTransaccion),
    });
  } catch (error) {
    console.error("listarPorCaja:", error);
    return res.status(500).json({ message: "Error al listar por caja." });
  }
};

/**
 * ✅ Listar transacciones por fecha (Fundador + Asistente)
 * Ruta: GET /api/flujo-caja/transacciones/fecha?fecha=YYYY-MM-DD
 */
export const listarPorFecha = async (req, res) => {
  try {
    const organizacionId = req.user.organizacion;
    const { fecha } = req.query;

    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({ message: "Parámetro 'fecha' inválido (YYYY-MM-DD)." });
    }

    // ✅ Rango UTC real correspondiente al día Bogotá
    const { inicioUTC, finUTC } = rangoUTCDesdeBusinessDate(fecha);

    const transacciones = await Transaction.find({
      organizacion: organizacionId,
      createdAt: { $gte: inicioUTC, $lte: finUTC },
    })
      .populate("paciente", "nombreCompleto numeroDocumento")
      .sort({ createdAt: 1 });

    return res.status(200).json({
      transacciones: transacciones.map(formatearTransaccion),
    });
  } catch (error) {
    console.error("listarPorFecha:", error);
    return res.status(500).json({ message: "Error al listar por fecha." });
  }
};

/**
 * ✅ Editar transacción (SOLO Fundador)
 * Ruta: PUT /api/flujo-caja/transaccion/:id
 */
export const editarTransaccion = async (req, res) => {
  try {
    if (req.user.rol !== "Fundador") {
      return res.status(403).json({ message: "No autorizado." });
    }

    const { id } = req.params;
    const organizacionId = req.user.organizacion;
    const userId = getUserId(req);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID de transacción inválido." });
    }

    // Rango HOY Bogotá (en UTC real)
    const businessDate = fechaISO();
    const { inicioUTC, finUTC } = rangoUTCDesdeBusinessDate(businessDate);

    const transaccion = await Transaction.findOne({
      _id: id,
      organizacion: organizacionId,
    }).populate("caja");

    if (!transaccion) {
      return res.status(404).json({ message: "Transacción no encontrada." });
    }

    const esDelDia =
      inRange(transaccion.createdAt, inicioUTC, finUTC) ||
      (transaccion.caja?.businessDate && transaccion.caja.businessDate === businessDate);

    if (!esDelDia) {
      return res.status(403).json({ message: "Solo puedes editar transacciones del día actual." });
    }

    if (!transaccion.caja || transaccion.caja.abierta !== true) {
      return res.status(403).json({ message: "No puedes editar: la caja del día está cerrada." });
    }

    const { categoria, descripcion, monto, metodoPago, paciente } = req.body;

    if (typeof descripcion !== "string" || !descripcion.trim()) {
      return res.status(400).json({ message: "Descripción inválida." });
    }

    const montoNumber = Number(monto);
    if (!Number.isFinite(montoNumber) || montoNumber <= 0) {
      return res.status(400).json({ message: "Monto inválido." });
    }

    const before = {
      categoria: transaccion.categoria,
      descripcion: transaccion.descripcion,
      monto: transaccion.monto,
      metodoPago: transaccion.metodoPago,
      paciente: transaccion.paciente || null,
    };

    transaccion.categoria = (categoria ?? "").toString().trim();
    transaccion.descripcion = descripcion.trim();
    transaccion.monto = montoNumber;
    if (metodoPago) transaccion.metodoPago = metodoPago;
    transaccion.paciente = paciente || undefined;

    await transaccion.save();

    await auditar(req, "EDITAR_TRANSACCION", {
      transaccionId: transaccion._id,
      before,
      after: {
        categoria: transaccion.categoria,
        descripcion: transaccion.descripcion,
        monto: transaccion.monto,
        metodoPago: transaccion.metodoPago,
        paciente: transaccion.paciente || null,
      },
    });

    const fechaClave = inicioDelDia(businessDate);
    await recalcularTodo(fechaClave, organizacionId, userId);

    return res.status(200).json({ message: "Transacción actualizada.", transaccion });
  } catch (error) {
    console.error("editarTransaccion:", error);
    return res.status(500).json({ message: "Error al editar transacción." });
  }
};

/**
 * ✅ Eliminar transacción (SOLO Fundador)
 * Ruta: DELETE /api/flujo-caja/transaccion/:id
 */
export const eliminarTransaccion = async (req, res) => {
  try {
    if (req.user.rol !== "Fundador") {
      return res.status(403).json({ message: "No autorizado." });
    }

    const { id } = req.params;
    const organizacionId = req.user.organizacion;
    const userId = getUserId(req);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID de transacción inválido." });
    }

    const businessDate = fechaISO();
    const { inicioUTC, finUTC } = rangoUTCDesdeBusinessDate(businessDate);

    const transaccion = await Transaction.findOne({
      _id: id,
      organizacion: organizacionId,
    }).populate("caja");

    if (!transaccion) {
      return res.status(404).json({ message: "Transacción no encontrada." });
    }

    const esDelDia =
      inRange(transaccion.createdAt, inicioUTC, finUTC) ||
      (transaccion.caja?.businessDate && transaccion.caja.businessDate === businessDate);

    if (!esDelDia) {
      return res.status(403).json({ message: "Solo puedes eliminar transacciones del día actual." });
    }

    if (!transaccion.caja || transaccion.caja.abierta !== true) {
      return res.status(403).json({ message: "No puedes eliminar: la caja del día está cerrada." });
    }

    const snapshot = {
      transaccionId: transaccion._id,
      tipo: transaccion.tipo,
      categoria: transaccion.categoria,
      descripcion: transaccion.descripcion,
      monto: transaccion.monto,
      metodoPago: transaccion.metodoPago,
      cajaId: transaccion.caja?._id,
    };

    await Transaction.deleteOne({ _id: transaccion._id });

    await auditar(req, "ELIMINAR_TRANSACCION", snapshot);

    const fechaClave = inicioDelDia(businessDate);
    await recalcularTodo(fechaClave, organizacionId, userId);

    return res.status(200).json({ message: "Transacción eliminada." });
  } catch (error) {
    console.error("eliminarTransaccion:", error);
    return res.status(500).json({ message: "Error al eliminar transacción." });
  }
};
