import PDFDocument from "pdfkit";
import Transaction from "../models/Transaction.js";
import Patient from "../models/Patient.js";
import Note from "../models/Note.js";
import CashRegister from "../models/CashRegister.js";

import { inicioDelDia, finDelDia } from "../config/timezone.js";
import { recalcularResumenDiario } from "../utils/recalculoCaja.js";

/* ========================================================================
   🧾 Exportar transacciones en PDF por fecha
   Fundador → permitido
   Asistente → permitido
   Profesional → PROHIBIDO
========================================================================= */
export const exportarCajaPDF = async (req, res) => {
    try {
        // Bloqueo explícito
        if (req.user.rol === "Profesional") {
            return res.status(403).json({
                message: "No tienes permisos para exportar reportes de caja.",
            });
        }

        const { fecha } = req.query;

        if (!fecha) {
            return res.status(400).json({ message: "La fecha es obligatoria." });
        }

        const inicioDia = inicioDelDia(fecha);
        const finDia = finDelDia(fecha);

        // Recalcular antes de PDF
        await recalcularResumenDiario(inicioDia, req.user.organizacion);

        const caja = await CashRegister.findOne({
            fecha: inicioDia,
            organizacion: req.user.organizacion,
        });

        if (!caja) {
            return res.status(404).json({ message: "No se encontró caja para esta fecha." });
        }

        const transacciones = await Transaction.find({
            createdAt: { $gte: inicioDia, $lt: finDia },
            organizacion: req.user.organizacion,
        })
            .populate("profesional", "nombre")
            .sort({ createdAt: 1 });

        const ingresos = transacciones
            .filter((t) => t.tipo === "Ingreso")
            .reduce((acc, t) => acc + t.monto, 0);

        const egresos = transacciones
            .filter((t) => t.tipo === "Egreso")
            .reduce((acc, t) => acc + t.monto, 0);

        const saldoFinal = caja.saldoInicial + ingresos - egresos;

        // PDF
        const doc = new PDFDocument({ margin: 50 });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=caja_${fecha}.pdf`);
        doc.pipe(res);

        doc.fontSize(18).text("Reporte de Caja - MBCare", { align: "center" });
        doc.moveDown();

        doc.fontSize(12).text(`Fecha: ${fecha}`);
        doc.fontSize(12).text(`Generado por: ${req.user.nombre}`);
        doc.moveDown();

        doc.fontSize(13).text("Resumen del día:");
        doc.fontSize(11).text(`Saldo inicial: $${caja.saldoInicial}`);
        doc.text(`Total ingresos: $${ingresos}`);
        doc.text(`Total egresos: $${egresos}`);
        doc.text(`Saldo final: $${saldoFinal}`);
        doc.moveDown();

        doc.fontSize(13).text("Transacciones:");
        doc.moveDown(0.5);

        if (transacciones.length === 0) {
            doc.fontSize(11).text("No hay transacciones registradas.");
        } else {
            transacciones.forEach((t, i) => {
                doc.fontSize(11).text(`${i + 1}. ${t.tipo} - $${t.monto}`);
                doc.text(`    ${t.descripcion}`);
                doc.text(`    Pago: ${t.metodoPago} | Profesional: ${t.profesional?.nombre || "N/A"}`);
                doc.moveDown(0.5);
            });
        }

        doc.end();
    } catch (error) {
        console.error("Error al exportar PDF de caja:", error);
        res.status(500).json({ message: "Error al generar PDF de caja." });
    }
};

/* ========================================================================
   Helpers (PDF NOTAS)
========================================================================= */
const formatFechaSesion = (d) => {
    if (!d) return "-";
    return new Date(d).toLocaleString("es-CO", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const buildContenidoClinico = (nota) => {
    // ✅ prioridad: virtual del modelo
    if (nota?.contenidoClinico && String(nota.contenidoClinico).trim()) {
        return String(nota.contenidoClinico).trim();
    }

    // ✅ fallback por campos nuevos
    const partes = [];
    if (nota?.observaciones && String(nota.observaciones).trim()) {
        partes.push(`Observaciones:\n${String(nota.observaciones).trim()}`);
    }
    if (nota?.diagnostico && String(nota.diagnostico).trim()) {
        partes.push(`Diagnóstico:\n${String(nota.diagnostico).trim()}`);
    }
    if (nota?.planTratamiento && String(nota.planTratamiento).trim()) {
        partes.push(`Plan de tratamiento:\n${String(nota.planTratamiento).trim()}`);
    }
    if (partes.length) return partes.join("\n\n");

    // ✅ fallback legacy
    return String(nota?.contenido || "").trim() || "Sin contenido";
};

const generarPDFNotasClinicas = async ({ req, res, numeroDocumento }) => {
    // userId/orgId robustos (compat con tu protect)
    const userId = req.user?._id || req.user?.id;
    const orgId = req.user?.organizacion;

    if (!numeroDocumento) {
        return res.status(400).json({ message: "El número de documento es obligatorio." });
    }
    if (!orgId) {
        return res.status(400).json({ message: "Organización no encontrada en el token." });
    }

    const paciente = await Patient.findOne({
        numeroDocumento,
        organizacion: orgId,
    });

    if (!paciente) {
        return res.status(404).json({ message: "Paciente no encontrado." });
    }

    const filtroNotas = {
        paciente: paciente._id,
        organizacion: orgId,
    };

    // Profesional solo puede exportar SUS notas
    if (req.user.rol === "Profesional") {
        filtroNotas.profesional = userId;
    }

    // ✅ ORDEN: antigua -> nueva por fechaSesion
    const notas = await Note.find(filtroNotas)
        .populate("profesional", "nombre")
        .sort({ fechaSesion: 1, createdAt: 1 });

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=notas_clinicas_${numeroDocumento}.pdf`);
    doc.pipe(res);

    doc.fontSize(18).text("Notas Clínicas - MBCare", { align: "center" });
    doc.moveDown();

    doc.fontSize(12).text(`Paciente: ${paciente.nombreCompleto}`);
    doc.fontSize(12).text(`Documento: ${paciente.tipoDocumento} ${numeroDocumento}`);
    doc.moveDown();

    if (!notas.length) {
        doc.fontSize(12).text("No se encontraron notas clínicas.");
        doc.end();
        return;
    }

    notas.forEach((nota, i) => {
        const fechaSesion = nota.fechaSesion || nota.createdAt;

        doc.fontSize(12).fillColor("black").text(`${i + 1}. Nota clínica`, { underline: true });

        doc
            .fontSize(10)
            .fillColor("gray")
            .text(`Profesional: ${nota.profesional?.nombre || "N/A"}`);

        // ✅ Fecha correcta (sesión)
        doc.fontSize(10).fillColor("gray").text(`Fecha de sesión: ${formatFechaSesion(fechaSesion)}`);
        doc.moveDown(0.6);

        // ✅ Contenido clínico real
        const contenido = buildContenidoClinico(nota);
        doc.fontSize(11).fillColor("black").text(contenido, { align: "left" });

        // Adjuntos
        if (Array.isArray(nota.adjuntos) && nota.adjuntos.length > 0) {
            doc.moveDown(0.4);
            doc.fontSize(10).fillColor("blue").text("Adjuntos:");

            nota.adjuntos.forEach((link) => {
                doc
                    .fontSize(9)
                    .fillColor("blue")
                    .text(`• ${link}`, { link, underline: true, indent: 20 });
            });
        }

        doc.moveDown(1.2);

        // salto de página si está al borde
        if (doc.y > 700) doc.addPage();
    });

    doc.end();
};

/* ========================================================================
   📤 Exportar notas clínicas por paciente (QUERY - legacy)
   GET /api/reportes/notas/pdf?numeroDocumento=...
========================================================================= */
export const exportarNotasClinicasPDF = async (req, res) => {
    try {
        const { numeroDocumento } = req.query;
        await generarPDFNotasClinicas({ req, res, numeroDocumento });
    } catch (error) {
        console.error("Error al exportar notas clínicas (query):", error);
        res.status(500).json({ message: "Error al generar PDF de notas clínicas." });
    }
};

/* ========================================================================
   📤 Exportar notas clínicas por paciente (PARAMS) ✅ NUEVO ENDPOINT
   GET /api/reportes/notas/:numeroDocumento
========================================================================= */
export const exportarNotasClinicasPDFPorParams = async (req, res) => {
    try {
        const { numeroDocumento } = req.params;
        await generarPDFNotasClinicas({ req, res, numeroDocumento });
    } catch (error) {
        console.error("Error al exportar notas clínicas (params):", error);
        res.status(500).json({ message: "Error al generar PDF de notas clínicas." });
    }
};
