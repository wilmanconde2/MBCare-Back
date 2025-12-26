import CashRegister from "../models/CashRegister.js";
import Transaction from "../models/Transaction.js";
import ResumenCaja from "../models/ResumenCaja.js";
import { inicioDelDia, finDelDia } from "../config/timezone.js";
import moment from "moment-timezone";
import PDFDocument from "pdfkit";
import { auditar } from "../utils/auditar.js";
import { recalcularResumenDiario } from "../utils/recalculoCaja.js";
import { recalcularTodo } from "../utils/recalculoCaja.js";

import {
    getRangoHoy,
    calcularTotales,
    formatearTransaccion,
    obtenerTransaccionesDeCajaOFecha,
    obtenerResumenOficialODerivado,
} from "../utils/cajaUtils.js";

/* =====================================================
   Estado caja hoy
   - Devuelve si hay caja hoy y si está abierta
===================================================== */
export const estadoCajaHoy = async (req, res) => {
    try {
        const { inicio, fin } = getRangoHoy();

        // Prioriza abierta si existe
        let caja = await CashRegister.findOne({
            fecha: { $gte: inicio, $lte: fin },
            organizacion: req.user.organizacion,
            abierta: true,
        });

        // Si no hay abierta, trae la última del día (cerrada)
        if (!caja) {
            caja = await CashRegister.findOne({
                fecha: { $gte: inicio, $lte: fin },
                organizacion: req.user.organizacion,
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

/* =====================================================
   Abrir caja
   - Regla: SOLO 1 caja diaria por organización (required)
===================================================== */
export const abrirCaja = async (req, res) => {
    try {
        const { saldoInicial } = req.body;

        if (typeof saldoInicial !== "number" || saldoInicial < 0) {
            return res.status(400).json({ message: "Saldo inicial inválido." });
        }

        const { inicio, fin } = getRangoHoy();

        // ✅ Regla 1 caja diaria: verificar por ORGANIZACIÓN (no por profesional)
        const existe = await CashRegister.findOne({
            fecha: { $gte: inicio, $lte: fin },
            organizacion: req.user.organizacion,
            abierta: true,
        });

        if (existe) {
            return res.status(400).json({ message: "Ya hay una caja abierta hoy." });
        }

        const profesionalId = req.user?._id || req.user?.id; // quien la abre
        if (!profesionalId) {
            return res.status(500).json({ message: "No se pudo determinar el profesional." });
        }

        const caja = await CashRegister.create({
            saldoInicial,
            profesional: profesionalId,
            organizacion: req.user.organizacion,
            abierta: true,
            fecha: inicio,
        });

        await auditar(req, "ABRIR_CAJA", { cajaId: caja._id, saldoInicial });

        return res.status(201).json({ message: "Caja abierta.", caja });
    } catch (error) {
        console.error("abrirCaja:", error);
        return res.status(500).json({ message: "Error al abrir caja." });
    }
};

/* =====================================================
   Cerrar caja
   - Regla: SOLO 1 caja diaria por organización (required)
   - Aquí sí recalculamos TODO (diario + mensual)
===================================================== */
export const cerrarCaja = async (req, res) => {
    try {
        const { inicio, fin } = getRangoHoy();
        const fechaClave = inicioDelDia(inicio);

        // ✅ Buscar caja abierta por ORGANIZACIÓN (no por profesional)
        const caja = await CashRegister.findOne({
            fecha: { $gte: inicio, $lte: fin },
            organizacion: req.user.organizacion,
            abierta: true,
        });

        if (!caja) {
            return res.status(404).json({ message: "No hay caja abierta hoy." });
        }

        const transacciones = await Transaction.find({
            caja: caja._id,
            organizacion: req.user.organizacion,
        });

        const { ingresos, egresos } = calcularTotales(transacciones);
        const saldoFinal = (Number(caja.saldoInicial) || 0) + ingresos - egresos;

        caja.abierta = false;
        caja.saldoFinal = saldoFinal;
        await caja.save();

        await auditar(req, "CERRAR_CAJA", {
            cajaId: caja._id,
            ingresos,
            egresos,
            saldoFinal,
        });

        // ✅ Cierre = FULL update
        await recalcularTodo(fechaClave, req.user.organizacion);

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

/* =====================================================
   Detalle caja
===================================================== */
export const detalleCajaPorId = async (req, res) => {
    try {
        const { cajaId } = req.params;
        const organizacionId = req.user.organizacion;

        const caja = await CashRegister.findById(cajaId).populate("profesional", "nombre email");
        if (!caja) return res.status(404).json({ message: "Caja no encontrada." });

        const transaccionesRaw = await obtenerTransaccionesDeCajaOFecha({
            organizacionId,
            cajaId: caja._id,
            fecha: caja.fecha,
        });

        const transacciones = transaccionesRaw.map(formatearTransaccion);
        const { ingresos, egresos } = calcularTotales(transacciones);

        const { resumen } = await obtenerResumenOficialODerivado({
            organizacionId,
            fechaClave: inicioDelDia(caja.fecha),
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

/* =====================================================
   Historial de cajas cerradas
   Fundador + Asistente (Profesional prohibido)
===================================================== */
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

        // Si quieres filtrar por profesional, mantenlo (no rompe la regla 1 caja/día)
        if (profesionalId) {
            filtros.profesional = profesionalId;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const cajas = await CashRegister.find(filtros)
            .populate("profesional", "nombre email")
            .sort({ fecha: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // ✅ Recalcular resumen diario (solo diario) para adjuntar totales consistentes
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
        console.error("historialCajas:", error);
        return res.status(500).json({
            message: "Error al obtener historial de cajas.",
        });
    }
};

/* =====================================================
   Exportar historial de cajas en PDF
   Solo Fundador
===================================================== */
export const exportarHistorialCajaPDF = async (req, res) => {
    try {
        if (req.user.rol !== "Fundador") {
            return res.status(403).json({
                message: "No tienes permisos para exportar historial de caja.",
            });
        }

        const TZ = "America/Bogota";
        const money = (n) => `$${Number(n || 0).toLocaleString("es-CO")}`;

        const { desde, hasta, profesionalId, mes } = req.query;

        const filtros = {
            abierta: false,
            organizacion: req.user.organizacion,
        };

        // =========================
        // ✅ Caso especial: UN SOLO DÍA (desde == hasta)
        // =========================
        const esRangoDia =
            desde &&
            hasta &&
            inicioDelDia(desde)?.getTime?.() === inicioDelDia(hasta)?.getTime?.();

        if (esRangoDia) {
            const fechaISO = desde; // viene en YYYY-MM-DD desde el front
            const inicio = inicioDelDia(fechaISO);
            const fin = finDelDia(inicio);

            // caja del día (por org y cerrada)
            const caja = await CashRegister.findOne({
                organizacion: req.user.organizacion,
                abierta: false,
                fecha: { $gte: inicio, $lte: fin },
            }).populate("profesional", "nombre email");

            if (!caja) {
                return res.status(404).json({ message: "No se encontró caja cerrada para esa fecha." });
            }

            // asegurar consistencia de totales (saldoFinal + ResumenCaja)
            await recalcularResumenDiario(caja.fecha, req.user.organizacion);

            // traer movimientos del día (por caja o fallback por rango del día)
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

            // Header
            doc.fontSize(18).text("Caja del día - MBCare", { align: "center" });
            doc.moveDown(0.8);

            doc.fontSize(11).fillColor("black");
            doc.text(`Fecha: ${moment(inicio).tz(TZ).format("YYYY-MM-DD")}`);
            doc.text(`Generado por: ${req.user.nombre || "Usuario"}`);
            doc.text(`Profesional de caja: ${caja.profesional?.nombre || "N/A"}`);
            doc.moveDown(0.8);

            // Resumen
            doc.fontSize(13).text("Resumen", { underline: true });
            doc.moveDown(0.4);

            doc.fontSize(11);
            doc.text(`Saldo inicial: ${money(saldoInicial)}`);
            doc.text(`Total ingresos: ${money(ingresos)}`);
            doc.text(`Total egresos: ${money(egresos)}`);
            doc.text(`Saldo final: ${money(saldoFinal)}`);
            doc.moveDown(0.8);

            // Movimientos
            doc.fontSize(13).text("Movimientos del día", { underline: true });
            doc.moveDown(0.6);

            if (!transacciones.length) {
                doc.fontSize(11).text("No hay transacciones registradas para este día.");
                doc.end();
                return;
            }

            // Helpers simples para layout
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

            // Encabezado tabla
            doc.fontSize(9).fillColor("#374151");
            doc.text("#", x0, doc.y, { width: col.idx });
            doc.text("Hora", x0 + col.idx, doc.y, { width: col.hora });
            doc.text("Tipo", x0 + col.idx + col.hora, doc.y, { width: col.tipo });
            doc.text("Monto", x0 + col.idx + col.hora + col.tipo, doc.y, { width: col.monto });
            doc.text("Método", x0 + col.idx + col.hora + col.tipo + col.monto, doc.y, {
                width: col.metodo,
            });
            doc.text(
                "Descripción",
                x0 + col.idx + col.hora + col.tipo + col.monto + col.metodo,
                doc.y,
                { width: col.desc }
            );
            doc.moveDown(0.4);
            yLine();
            doc.moveDown(0.4);

            // Filas
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

                doc.text(montoTxt, x0 + col.idx + col.hora + col.tipo, yStart, {
                    width: col.monto,
                });

                doc.text(metodoTxt, x0 + col.idx + col.hora + col.tipo + col.monto, yStart, {
                    width: col.metodo,
                });

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

        // =========================
        // Caso normal: mes / año / rango (historial)
        // =========================
        if (mes && /^\d{4}-\d{2}$/.test(mes)) {
            const inicio = moment.tz(`${mes}-01`, TZ).startOf("month").toDate();
            const fin = moment.tz(inicio, TZ).endOf("month").toDate();
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

        // ✅ Recalcular resumen diario para que saldoFinal/ResumenCaja esté consistente
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
        return res.status(500).json({
            message: "Error al generar PDF del historial de cajas.",
        });
    }
};
