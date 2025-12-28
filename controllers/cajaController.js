import CashRegister from "../models/CashRegister.js";
import Transaction from "../models/Transaction.js";
import ResumenCaja from "../models/ResumenCaja.js";
import ConsolidadoMensual from "../models/ConsolidadoMensual.js";
import { inicioDelDia, finDelDia, fechaISO, ZONA_HORARIA, rangoUTCDesdeBusinessDate } from "../config/timezone.js";
import moment from "moment-timezone";
import PDFDocument from "pdfkit";
import { auditar } from "../utils/auditar.js";
import { recalcularResumenDiario, recalcularTodo } from "../utils/recalculoCaja.js";

import {
    calcularTotales,
    formatearTransaccion,
    obtenerTransaccionesDeCajaOFecha,
    obtenerResumenOficialODerivado,
} from "../utils/cajaUtils.js";

/**
 * Helper: userId consistente
 */
const getUserId = (req) => req.user?._id || req.user?.id;

/**
 * ✅ Estado de la caja de HOY (por businessDate Bogotá)
 * Ruta: GET /api/caja/estado-hoy
 */
export const estadoCajaHoy = async (req, res) => {
    try {
        const organizacionId = req.user.organizacion;
        const businessDate = fechaISO(); // YYYY-MM-DD en Bogotá :contentReference[oaicite:1]{index=1}

        // Prioridad: caja abierta del día
        let caja = await CashRegister.findOne({
            organizacion: organizacionId,
            businessDate,
            abierta: true,
        });

        // Si no hay abierta, busca la última del día (abierta o cerrada)
        if (!caja) {
            caja = await CashRegister.findOne({
                organizacion: organizacionId,
                businessDate,
            }).sort({ createdAt: -1 });
        }

        return res.status(200).json({
            abierta: !!caja?.abierta,
            caja: caja || null,
        });
    } catch (error) {
        console.error("estadoCajaHoy:", error);
        return res.status(500).json({ message: "Error del servidor." });
    }
};

/**
 * ✅ Abrir caja de HOY (por businessDate Bogotá)
 * Ruta: POST /api/caja/abrir
 */
export const abrirCaja = async (req, res) => {
    try {
        const organizacionId = req.user.organizacion;
        const profesionalId = getUserId(req);

        const { saldoInicial } = req.body;

        const saldo = Number(saldoInicial);
        if (!Number.isFinite(saldo) || saldo < 0) {
            return res.status(400).json({ message: "Saldo inicial inválido." });
        }

        const businessDate = fechaISO(); // Bogotá (YYYY-MM-DD) :contentReference[oaicite:2]{index=2}

        const existe = await CashRegister.findOne({
            organizacion: organizacionId,
            businessDate,
            abierta: true,
        });

        if (existe) {
            return res.status(400).json({ message: "Ya hay una caja abierta hoy." });
        }

        // Mantener compatibilidad: fecha como inicio del día Bogotá (Date UTC equivalente)
        const fecha = inicioDelDia(businessDate);

        const caja = await CashRegister.create({
            businessDate,
            timezone: ZONA_HORARIA || "America/Bogota",
            fecha,
            saldoInicial: saldo,
            saldoFinal: saldo,
            profesional: profesionalId,
            organizacion: organizacionId,
            abierta: true,
        });

        await auditar(req, "ABRIR_CAJA", { cajaId: caja._id, businessDate, saldoInicial: saldo });

        return res.status(201).json({ message: "Caja abierta.", caja });
    } catch (error) {
        console.error("abrirCaja:", error);
        return res.status(500).json({ message: "Error al abrir caja." });
    }
};

/**
 * ✅ Cerrar caja de HOY (por businessDate Bogotá)
 * Ruta: POST /api/caja/cerrar
 */
export const cerrarCaja = async (req, res) => {
    try {
        const organizacionId = req.user.organizacion;
        const userId = getUserId(req);

        const businessDate = fechaISO(); // Bogotá
        const caja = await CashRegister.findOne({
            organizacion: organizacionId,
            businessDate,
            abierta: true,
        });

        if (!caja) {
            return res.status(404).json({ message: "No hay caja abierta hoy." });
        }

        const transacciones = await Transaction.find({
            caja: caja._id,
            organizacion: organizacionId,
        });

        const { ingresos, egresos } = calcularTotales(transacciones);
        const saldoFinal = (Number(caja.saldoInicial) || 0) + ingresos - egresos;

        caja.abierta = false;
        caja.saldoFinal = saldoFinal;
        await caja.save();

        await auditar(req, "CERRAR_CAJA", { cajaId: caja._id, businessDate, ingresos, egresos, saldoFinal });

        // Recalcular todo usando fechaClave (inicio del día Bogotá)
        const fechaClave = inicioDelDia(businessDate);
        await recalcularTodo(fechaClave, organizacionId, userId);

        // ✅ FIX: persistir (upsert) el resumen diario al cerrar caja (no depender solo del recalculo)
        await ResumenCaja.findOneAndUpdate(
            { organizacion: organizacionId, businessDate },
            {
                $set: {
                    businessDate,
                    timezone: ZONA_HORARIA || "America/Bogota",
                    fecha: fechaClave, // compat (inicio del día)
                    saldoInicial: Number(caja.saldoInicial) || 0,
                    ingresosTotales: ingresos,
                    egresosTotales: egresos,
                    saldoFinal,
                    creadoPor: userId,
                },
            },
            { upsert: true, new: true }
        );

        // ✅ Recalcular y persistir consolidado mensual del mes actual (Bogotá)
        const TZ = "America/Bogota";
        const m = moment.tz(businessDate, "YYYY-MM-DD", TZ);

        const mes = m.month() + 1;       // 1..12
        const anio = m.year();

        const fechaInicioMes = m.clone().startOf("month").toDate();
        const fechaFinMes = m.clone().endOf("month").toDate();

        // Traer todos los resúmenes del mes
        const resumenesMes = await ResumenCaja.find({
            fecha: { $gte: fechaInicioMes, $lte: fechaFinMes },
            organizacion: organizacionId,
        }).sort({ fecha: 1 });

        const ingresosTotalesMes = resumenesMes.reduce((acc, r) => acc + (Number(r.ingresosTotales) || 0), 0);
        const egresosTotalesMes = resumenesMes.reduce((acc, r) => acc + (Number(r.egresosTotales) || 0), 0);

        const saldoInicialMes = resumenesMes.length ? (Number(resumenesMes[0].saldoInicial) || 0) : 0;
        const saldoFinalMes = saldoInicialMes + ingresosTotalesMes - egresosTotalesMes;

        await ConsolidadoMensual.findOneAndUpdate(
            { mes, anio, organizacion: organizacionId },
            {
                $set: {
                    mes,
                    anio,
                    organizacion: organizacionId,
                    ingresosTotales: ingresosTotalesMes,
                    egresosTotales: egresosTotalesMes,
                    saldoInicial: saldoInicialMes,
                    saldoFinal: saldoFinalMes,
                    creadoPor: userId,
                    ultimaActualizacion: new Date(),
                },
            },
            { upsert: true, new: true }
        );

        return res.status(200).json({
            message: "Caja cerrada.",
            caja,
            resumen: { ingresos, egresos, saldoFinal },
        });
    } catch (error) {
        console.error("cerrarCaja:", error);
        return res.status(500).json({ message: "Error al cerrar caja." });
    }
};

/**
 * ✅ Detalle caja por ID (compat + consistente)
 * Ruta: GET /api/caja/detalle/:cajaId
 */
export const detalleCajaPorId = async (req, res) => {
    try {
        const { cajaId } = req.params;
        const organizacionId = req.user.organizacion;

        const caja = await CashRegister.findById(cajaId).populate("profesional", "nombre email");
        if (!caja) return res.status(404).json({ message: "Caja no encontrada." });

        // Transacciones de esa caja
        const transaccionesRaw = await obtenerTransaccionesDeCajaOFecha({
            organizacionId,
            cajaId: caja._id,
            fecha: caja.fecha, // compat
        });

        const transacciones = (transaccionesRaw || []).map(formatearTransaccion);
        const { ingresos, egresos } = calcularTotales(transacciones);

        const fechaClave = inicioDelDia(caja.businessDate || caja.fecha);
        const { resumen } = await obtenerResumenOficialODerivado({
            organizacionId,
            fechaClave,
            cajaSaldoInicial: caja.saldoInicial,
            ingresosCalc: ingresos,
            egresosCalc: egresos,
        });

        return res.status(200).json({
            caja,
            resumen,
            transacciones,
            totales: { ingresos, egresos },
        });
    } catch (error) {
        console.error("detalleCajaPorId:", error);
        return res.status(500).json({ message: "Error al obtener detalle." });
    }
};

/**
 * ✅ Historial de cajas cerradas
 * Ruta: GET /api/caja/historial
 *
 * Nota: aquí mantenemos filtros por rango/mes con fechas Date porque ya tienes PDF/queries montadas así.
 * Para no tocar todo, seguimos usando `fecha` Date, pero internamente las cajas nuevas tienen businessDate.
 */
export const historialCajas = async (req, res) => {
    try {
        if (req.user.rol === "Profesional") {
            return res.status(403).json({ message: "No tienes permisos para acceder al historial de caja." });
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
            filtros.fecha = { $gte: inicioDelDia(desde), $lte: finDelDia(hasta) };
        }

        if (profesionalId) {
            filtros.profesional = profesionalId;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const cajas = await CashRegister.find(filtros)
            .populate("profesional", "nombre email")
            .sort({ fecha: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Recalcular resumen diario para cada caja (manteniendo compat)
        for (const caja of cajas) {
            await recalcularResumenDiario(caja.fecha, organizacionId);
        }

        const fechasInicioDia = cajas.map((c) => inicioDelDia(c.businessDate || c.fecha));
        const resumenes = await ResumenCaja.find({
            organizacion: organizacionId,
            fecha: { $in: fechasInicioDia },
        });

        const mapResumenPorFecha = new Map(resumenes.map((r) => [new Date(r.fecha).toISOString(), r]));

        const cajasConTotales = cajas.map((c) => {
            const key = new Date(inicioDelDia(c.businessDate || c.fecha)).toISOString();
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
        console.error("historialCajas:", error);
        return res.status(500).json({ message: "Error al obtener historial de cajas." });
    }
};

/**
 * ✅ Exportar historial a PDF
 * Ruta: GET /api/caja/historial/exportar
 *
 * Mantiene compat usando fecha Date. No tocamos la estructura del PDF.
 */
export const exportarHistorialCajaPDF = async (req, res) => {
    try {
        if (req.user.rol !== "Fundador") {
            return res.status(403).json({ message: "No tienes permisos para exportar historial de caja." });
        }

        const TZ = "America/Bogota";
        const money = (n) => `$${Number(n || 0).toLocaleString("es-CO")}`;

        const { desde, hasta, profesionalId, mes } = req.query;

        const filtros = {
            abierta: false,
            organizacion: req.user.organizacion,
        };

        const esRangoDia =
            desde &&
            hasta &&
            inicioDelDia(desde)?.getTime?.() === inicioDelDia(hasta)?.getTime?.();

        // Exportar un día exacto
        if (esRangoDia) {
            const fechaISO = desde;
            const inicio = inicioDelDia(fechaISO);
            const fin = finDelDia(inicio);

            const caja = await CashRegister.findOne({
                organizacion: req.user.organizacion,
                abierta: false,
                fecha: { $gte: inicio, $lte: fin },
            }).populate("profesional", "nombre email");

            if (!caja) {
                return res.status(404).json({ message: "No se encontró caja cerrada para esa fecha." });
            }

            await recalcularResumenDiario(caja.fecha, req.user.organizacion);

            const transaccionesRaw = await obtenerTransaccionesDeCajaOFecha({
                organizacionId: req.user.organizacion,
                cajaId: caja._id,
                fecha: caja.fecha,
                populatePaciente: true,
            });

            const transacciones = (transaccionesRaw || []).map(formatearTransaccion);

            const ingresos = transacciones
                .filter((t) => t.tipo === "Ingreso")
                .reduce((acc, t) => acc + (Number(t.monto) || 0), 0);

            const egresos = transacciones
                .filter((t) => t.tipo === "Egreso")
                .reduce((acc, t) => acc + (Number(t.monto) || 0), 0);

            const saldoInicial = Number(caja.saldoInicial) || 0;
            const saldoFinal = saldoInicial + ingresos - egresos;

            await auditar(req, "EXPORTAR_CAJA_DIA_PDF", {
                fecha: fechaISO,
                cajaId: caja._id,
                totalMovimientos: transacciones.length,
            });

            const doc = new PDFDocument({ margin: 50 });
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename=caja_${fechaISO}.pdf`);
            doc.pipe(res);

            doc.fontSize(18).text("Caja del día - MBCare", { align: "center" });
            doc.moveDown(0.8);

            doc.fontSize(11).fillColor("black");
            doc.text(`Fecha: ${moment(inicio).tz(TZ).format("YYYY-MM-DD")}`);
            doc.text(`Generado por: ${req.user.nombre || "Usuario"}`);
            doc.text(`Profesional de caja: ${caja.profesional?.nombre || "N/A"}`);
            doc.moveDown(0.8);

            doc.fontSize(13).text("Resumen", { underline: true });
            doc.moveDown(0.4);

            doc.fontSize(11);
            doc.text(`Saldo inicial: ${money(saldoInicial)}`);
            doc.text(`Total ingresos: ${money(ingresos)}`);
            doc.text(`Total egresos: ${money(egresos)}`);
            doc.text(`Saldo final: ${money(saldoFinal)}`);
            doc.moveDown(0.8);

            doc.fontSize(13).text("Movimientos del día", { underline: true });
            doc.moveDown(0.6);

            if (!transacciones.length) {
                doc.fontSize(11).text("No hay transacciones registradas para este día.");
                doc.end();
                return;
            }

            // render tabla simple (igual que ya tenías)
            const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
            const col = {
                idx: 28,
                hora: 48,
                tipo: 56,
                monto: 90,
                metodo: 80,
                desc: pageWidth - (28 + 48 + 56 + 90 + 80) - 10,
            };

            const x0 = doc.page.margins.left;
            const yLine = () => {
                doc
                    .moveTo(doc.page.margins.left, doc.y)
                    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
                    .strokeColor("#e5e7eb")
                    .stroke();
                doc.strokeColor("black");
            };

            const ensureSpace = (needed = 60) => {
                const bottom = doc.page.height - doc.page.margins.bottom;
                if (doc.y + needed > bottom) doc.addPage();
            };

            doc.fontSize(9).fillColor("#374151");
            doc.text("#", x0, doc.y, { width: col.idx });
            doc.text("Hora", x0 + col.idx, doc.y, { width: col.hora });
            doc.text("Tipo", x0 + col.idx + col.hora, doc.y, { width: col.tipo });
            doc.text("Monto", x0 + col.idx + col.hora + col.tipo, doc.y, { width: col.monto });
            doc.text("Método", x0 + col.idx + col.hora + col.tipo + col.monto, doc.y, { width: col.metodo });
            doc.text(
                "Descripción",
                x0 + col.idx + col.hora + col.tipo + col.monto + col.metodo,
                doc.y,
                { width: col.desc }
            );
            doc.moveDown(0.4);
            yLine();
            doc.moveDown(0.4);

            doc.fontSize(9).fillColor("black");

            transacciones.forEach((t, i) => {
                ensureSpace(70);

                const tipoTxt = t.tipo || "";
                const montoTxt = money(t.monto);
                const metodoTxt = t.metodo || "N/A";

                let desc = t.descripcion || "Sin descripción";
                if (t.categoria) desc += ` | Cat: ${t.categoria}`;
                if (t.paciente) desc += ` | Paciente: ${t.paciente}`;

                const yStart = doc.y;

                doc.text(String(i + 1), x0, yStart, { width: col.idx });
                doc.text(t.hora || "", x0 + col.idx, yStart, { width: col.hora });
                doc.text(tipoTxt, x0 + col.idx + col.hora, yStart, { width: col.tipo });
                doc.text(montoTxt, x0 + col.idx + col.hora + col.tipo, yStart, { width: col.monto });
                doc.text(
                    metodoTxt,
                    x0 + col.idx + col.hora + col.tipo + col.monto,
                    yStart,
                    { width: col.metodo }
                );
                doc.text(
                    desc,
                    x0 + col.idx + col.hora + col.tipo + col.monto + col.metodo,
                    yStart,
                    { width: col.desc }
                );

                doc.moveDown(0.6);
                yLine();
                doc.moveDown(0.4);
            });

            doc.end();
            return;
        }

        // rango por mes o fechas
        if (mes && /^\d{4}-\d{2}$/.test(mes)) {
            const inicio = moment.tz(`${mes}-01`, TZ).startOf("month").toDate();
            const fin = moment.tz(inicio, TZ).endOf("month").toDate();
            filtros.fecha = { $gte: inicio, $lte: fin };
        } else if (desde && hasta) {
            filtros.fecha = { $gte: inicioDelDia(desde), $lte: finDelDia(hasta) };
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

        const doc = new PDFDocument({ margin: 50 });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "attachment; filename=historial_cajas.pdf");
        doc.pipe(res);

        doc.fontSize(18).text("Historial Cuadre Diario - MBCare", { align: "center" });
        doc.moveDown();

        if (cajas.length === 0) {
            doc.fontSize(12).text("No se encontraron cajas cerradas con los filtros proporcionados.");
            doc.end();
            return;
        }

        let totalFinal = 0;

        cajas.forEach((caja, i) => {
            const fecha = moment(caja.fecha).tz(TZ).format("DD-MM-YYYY");
            doc.fontSize(12).text(`${i + 1}. Fecha: ${fecha}`);
            doc.fontSize(10).text(`   Profesional: ${caja.profesional?.nombre || "N/A"}`);
            doc.text(`   Saldo Inicial: $${Number(caja.saldoInicial || 0).toLocaleString("es-CO")}`);
            doc.text(`   Saldo Final:   $${Number(caja.saldoFinal || 0).toLocaleString("es-CO")}`);
            doc.moveDown();

            totalFinal += Number(caja.saldoFinal || 0);
        });

        doc.fontSize(12).text("Resumen Total:", { underline: true });
        doc.text(`Total de cajas cerradas: ${cajas.length}`);
        doc.text(`Saldo final total: $${Number(totalFinal || 0).toLocaleString("es-CO")}`);

        doc.end();
    } catch (error) {
        console.error("exportarHistorialCajaPDF:", error);
        return res.status(500).json({ message: "Error al generar PDF del historial de cajas." });
    }
};
