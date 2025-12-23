import CashRegister from "../models/CashRegister.js";
import Transaction from "../models/Transaction.js";
import ResumenCaja from "../models/ResumenCaja.js";
import { inicioDelDia, finDelDia } from "../config/timezone.js";
import moment from "moment-timezone";
import PDFDocument from "pdfkit";
import { auditar } from "../utils/auditar.js";
import { recalcularResumenDiario } from "../utils/recalculoCaja.js";

/**
 * ✅ NUEVO: Estado de la caja de HOY (abierta/cerrada + caja)
 * Fundador / Asistente (mismos permisos que historial, ajustable)
 */
export const estadoCajaHoy = async (req, res) => {
    try {
        const profesionalId = req.user?._id || req.user?.id;
        if (!profesionalId) {
            return res.status(500).json({ message: "No se pudo determinar el profesional." });
        }

        const hoyInicio = inicioDelDia();
        const hoyFin = finDelDia();

        // Buscamos caja de hoy (abierta o cerrada). Priorizamos la abierta si existe.
        let caja = await CashRegister.findOne({
            fecha: { $gte: hoyInicio, $lte: hoyFin },
            organizacion: req.user.organizacion,
            abierta: true,
        });

        if (!caja) {
            caja = await CashRegister.findOne({
                fecha: { $gte: hoyInicio, $lte: hoyFin },
                organizacion: req.user.organizacion,
            }).sort({ createdAt: -1 });
        }

        return res.status(200).json({
            abierta: !!caja?.abierta,
            caja: caja || null,
        });
    } catch (error) {
        console.error("Error al obtener estado de caja:", error);
        return res.status(500).json({ message: "Error del servidor al obtener estado de caja." });
    }
};

/**
 * Abrir caja del día
 */
export const abrirCaja = async (req, res) => {
    try {
        const { saldoInicial } = req.body;

        if (typeof saldoInicial !== "number" || saldoInicial < 0) {
            return res.status(400).json({
                message: "El valor de apertura es requerido y debe ser válido.",
            });
        }

        const profesionalId = req.user?._id || req.user?.id;
        if (!profesionalId) {
            console.error("abrirCaja: usuario sin id válido", req.user);
            return res.status(500).json({ message: "No se pudo determinar el profesional." });
        }

        const hoyInicio = inicioDelDia();
        const hoyFin = finDelDia();

        const existeCajaHoy = await CashRegister.findOne({
            fecha: { $gte: hoyInicio, $lte: hoyFin },
            profesional: profesionalId,
            organizacion: req.user.organizacion,
            abierta: true,
        });

        if (existeCajaHoy) {
            return res.status(400).json({ message: "Ya hay una caja abierta para hoy." });
        }

        const nuevaCaja = await CashRegister.create({
            saldoInicial,
            profesional: profesionalId,
            organizacion: req.user.organizacion,
            abierta: true,
            fecha: hoyInicio,
        });

        await auditar(req, "ABRIR_CAJA", {
            cajaId: nuevaCaja._id,
            saldoInicial,
        });

        return res.status(201).json({
            message: "Caja del día abierta exitosamente.",
            caja: nuevaCaja,
        });
    } catch (error) {
        console.error("Error al abrir caja:", error);
        return res.status(500).json({ message: "Error del servidor al abrir caja." });
    }
};

/**
 * Cerrar caja del día
 */
export const cerrarCaja = async (req, res) => {
    try {
        const profesionalId = req.user?._id || req.user?.id;
        if (!profesionalId) {
            console.error("cerrarCaja: usuario sin id válido", req.user);
            return res.status(500).json({ message: "No se pudo determinar el profesional." });
        }

        const hoyInicio = inicioDelDia();
        const hoyFin = finDelDia();

        const caja = await CashRegister.findOne({
            fecha: { $gte: hoyInicio, $lte: hoyFin },
            profesional: profesionalId,
            organizacion: req.user.organizacion,
            abierta: true,
        });

        if (!caja) {
            return res.status(404).json({ message: "No hay una caja abierta para hoy." });
        }

        const transacciones = await Transaction.find({
            caja: caja._id,
            organizacion: req.user.organizacion,
        });

        const totalIngresos = transacciones
            .filter((t) => t.tipo === "Ingreso")
            .reduce((acc, t) => acc + t.monto, 0);

        const totalEgresos = transacciones
            .filter((t) => t.tipo === "Egreso")
            .reduce((acc, t) => acc + t.monto, 0);

        const saldoFinal = caja.saldoInicial + totalIngresos - totalEgresos;

        caja.abierta = false;
        caja.saldoFinal = saldoFinal;
        await caja.save();

        const resumenExistente = await ResumenCaja.findOne({
            fecha: hoyInicio,
            organizacion: req.user.organizacion,
        });

        if (!resumenExistente) {
            await ResumenCaja.create({
                fecha: hoyInicio,
                organizacion: req.user.organizacion,
                ingresosTotales: totalIngresos,
                egresosTotales: totalEgresos,
                saldoInicial: caja.saldoInicial,
                saldoFinal,
                creadoPor: profesionalId,
            });
        }

        await auditar(req, "CERRAR_CAJA", {
            cajaId: caja._id,
            ingresos: totalIngresos,
            egresos: totalEgresos,
            saldoInicial: caja.saldoInicial,
            saldoFinal,
        });

        await recalcularResumenDiario(hoyInicio, req.user.organizacion);

        return res.status(200).json({
            message: "Caja cerrada exitosamente.",
            caja,
            resumen: {
                ingresos: totalIngresos,
                egresos: totalEgresos,
                saldoFinal,
            },
        });
    } catch (error) {
        console.error("Error al cerrar caja:", error);
        return res.status(500).json({ message: "Error del servidor al cerrar caja." });
    }
};

/**
 * Historial de cajas cerradas
 */
export const historialCajas = async (req, res) => {
    try {
        if (req.user.rol === "Profesional") {
            return res.status(403).json({
                message: "No tienes permisos para acceder al historial de caja.",
            });
        }

        const organizacionId = req.user.organizacion;
        const { page = 1, limit = 10, desde, hasta, profesionalId, mes } = req.query;

        const filtros = {
            abierta: false,
            organizacion: organizacionId,
        };

        if (mes && /^\d{4}-\d{2}$/.test(mes)) {
            const fechaInicio = moment.tz(`${mes}-01`, "America/Bogota").startOf("month").toDate();
            const fechaFin = moment.tz(fechaInicio, "America/Bogota").endOf("month").toDate();
            filtros.fecha = { $gte: fechaInicio, $lte: fechaFin };
        }

        if (desde && hasta) {
            filtros.fecha = {
                $gte: inicioDelDia(desde),
                $lte: finDelDia(hasta),
            };
        }

        if (req.user.rol === "Fundador" && profesionalId) {
            filtros.profesional = profesionalId;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const cajas = await CashRegister.find(filtros)
            .populate("profesional", "nombre email")
            .sort({ fecha: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // ✅ Recalcular resumen (si aplica) y adjuntar ingresos/egresos desde ResumenCaja
        for (const caja of cajas) {
            await recalcularResumenDiario(caja.fecha, organizacionId);
        }

        const fechasInicioDia = cajas.map((c) => inicioDelDia(c.fecha));
        const resumenes = await ResumenCaja.find({
            organizacion: organizacionId,
            fecha: { $in: fechasInicioDia },
        });

        const mapResumenPorFecha = new Map(
            resumenes.map((r) => [new Date(r.fecha).toISOString(), r])
        );

        const cajasConTotales = cajas.map((c) => {
            const key = new Date(inicioDelDia(c.fecha)).toISOString();
            const r = mapResumenPorFecha.get(key);

            const obj = c.toObject();
            obj.ingresosTotales = r?.ingresosTotales ?? 0;
            obj.egresosTotales = r?.egresosTotales ?? 0;
            return obj;
        });

        const total = await CashRegister.countDocuments(filtros);

        return res.status(200).json({
            total,
            paginaActual: parseInt(page),
            totalPaginas: Math.ceil(total / limit),
            cajas: cajasConTotales,
        });
    } catch (error) {
        console.error("Error al listar historial de cajas:", error);
        return res.status(500).json({
            message: "Error al obtener historial de cajas.",
        });
    }
};

/**
 * Exportar historial de cajas en PDF
 */
export const exportarHistorialCajaPDF = async (req, res) => {
    try {
        if (req.user.rol !== "Fundador") {
            return res.status(403).json({
                message: "No tienes permisos para exportar historial de caja.",
            });
        }

        const { desde, hasta, profesionalId, mes } = req.query;

        const filtros = {
            abierta: false,
            organizacion: req.user.organizacion,
        };

        if (mes && /^\d{4}-\d{2}$/.test(mes)) {
            const inicio = moment.tz(`${mes}-01`, "America/Bogota").startOf("month").toDate();
            const fin = moment.tz(inicio, "America/Bogota").endOf("month").toDate();
            filtros.fecha = { $gte: inicio, $lte: fin };
        } else if (desde && hasta) {
            filtros.fecha = {
                $gte: inicioDelDia(desde),
                $lte: finDelDia(hasta),
            };
        }

        if (profesionalId) {
            filtros.profesional = profesionalId;
        }

        const cajas = await CashRegister.find(filtros)
            .populate("profesional", "nombre email")
            .sort({ fecha: -1 });

        for (const caja of cajas) {
            await recalcularResumenDiario(caja.fecha, req.user.organizacion);
        }

        await auditar(req, "EXPORTAR_HISTORIAL_PDF", { filtros: req.query });

        const doc = new PDFDocument();
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "attachment; filename=historial_cajas.pdf");
        doc.pipe(res);

        doc.fontSize(18).text("Historial Cuadre Diario - MBCare", { align: "center" });
        doc.moveDown();

        if (cajas.length === 0) {
            doc.fontSize(12).text("No se encontraron cajas cerradas con los filtros proporcionados.");
        } else {
            let totalFinal = 0;

            cajas.forEach((caja, i) => {
                const fecha = moment(caja.fecha).format("DD-MM-YYYY");
                doc.fontSize(12).text(`${i + 1}. Fecha: ${fecha}`);
                doc.fontSize(10).text(`   Profesional: ${caja.profesional?.nombre || "N/A"}`);
                doc.text(`   Saldo Inicial: $${caja.saldoInicial}`);
                doc.text(`   Saldo Final:   $${caja.saldoFinal}`);
                doc.moveDown();

                totalFinal += caja.saldoFinal;
            });

            doc.fontSize(12).text("Resumen Total:", { underline: true });
            doc.text(`Total de cajas cerradas: ${cajas.length}`);
            doc.text(`Saldo final total: $${totalFinal.toLocaleString()}`);
        }

        doc.end();
    } catch (error) {
        console.error("Error al exportar historial de cajas:", error);
        return res.status(500).json({
            message: "Error al generar PDF del historial de cajas.",
        });
    }
};
