import PDFDocument from "pdfkit";
import Transaction from "../models/Transaction.js";
import Patient from "../models/Patient.js";
import Note from "../models/Note.js";
import CashRegister from "../models/CashRegister.js";

import { inicioDelDia, finDelDia } from "../config/timezone.js";
import { recalcularResumenDiario } from "../utils/recalculoCaja.js";   // ✔ NUEVO

/* ========================================================================
   🧾 Exportar transacciones en PDF por fecha
   Fundador → permitido
   Asistente → permitido
   Profesional → PROHIBIDO
========================================================================= */
export const exportarCajaPDF = async (req, res) => {
    try {
        // Bloqueo explícito para evitar uso por Postman
        if (req.user.rol === "Profesional") {
            return res.status(403).json({
                message: "No tienes permisos para exportar reportes de caja."
            });
        }

        const { fecha } = req.query;

        if (!fecha) {
            return res.status(400).json({ message: "La fecha es obligatoria." });
        }

        const inicioDia = inicioDelDia(fecha);
        const finDia = finDelDia(fecha);

        // ✔ Recalcular antes de generar PDF
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
            .filter(t => t.tipo === "Ingreso")
            .reduce((acc, t) => acc + t.monto, 0);

        const egresos = transacciones
            .filter(t => t.tipo === "Egreso")
            .reduce((acc, t) => acc + t.monto, 0);

        const saldoFinal = caja.saldoInicial + ingresos - egresos;

        // PDF
        const doc = new PDFDocument();
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=caja_${fecha}.pdf`
        );
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
                doc.text(
                    `    Pago: ${t.metodoPago} | Profesional: ${t.profesional?.nombre || "N/A"}`
                );
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
   📤 Exportar notas clínicas por paciente
   Fundador → ve todas
   Asistente → ve todas
   Profesional → SOLO SUS notas
========================================================================= */
export const exportarNotasClinicasPDF = async (req, res) => {
    try {
        const { numeroDocumento } = req.query;

        if (!numeroDocumento) {
            return res.status(400).json({
                message: "El número de documento es obligatorio."
            });
        }

        const paciente = await Patient.findOne({
            numeroDocumento,
            organizacion: req.user.organizacion,
        });

        if (!paciente) {
            return res.status(404).json({ message: "Paciente no encontrado." });
        }

        const filtroNotas = {
            paciente: paciente._id,
            organizacion: req.user.organizacion,
        };

        // Profesional solo puede exportar SUS propias notas
        if (req.user.rol === "Profesional") {
            filtroNotas.profesional = req.user._id;
        }

        const notas = await Note.find(filtroNotas)
            .populate("profesional", "nombre")
            .sort({ createdAt: -1 });

        const doc = new PDFDocument();
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=notas_clinicas_${numeroDocumento}.pdf`
        );
        doc.pipe(res);

        doc.fontSize(18).text("Notas Clínicas - MBCare", { align: "center" });
        doc.moveDown();

        doc.fontSize(12).text(`Paciente: ${paciente.nombreCompleto}`);
        doc.fontSize(12).text(
            `Documento: ${paciente.tipoDocumento} ${numeroDocumento}`
        );
        doc.moveDown();

        if (notas.length === 0) {
            doc.text("No se encontraron notas clínicas.");
        } else {
            notas.forEach((nota, i) => {
                doc.fontSize(12).text(`${i + 1}. ${nota.titulo || "Sin título"}`, {
                    underline: true,
                });

                doc
                    .fontSize(10)
                    .fillColor("gray")
                    .text(
                        `Tipo: ${nota.tipoNota || "General"} | Profesional: ${nota.profesional?.nombre}`
                    );

                doc.text(`Fecha: ${new Date(nota.createdAt).toLocaleString("es-CO")}`);
                doc.moveDown(0.5);

                doc.fontSize(11).fillColor("black").text(nota.contenido, {
                    align: "left",
                    indent: 20,
                });

                if (Array.isArray(nota.adjuntos) && nota.adjuntos.length > 0) {
                    doc.moveDown(0.4);
                    doc.fontSize(10).fillColor("blue").text("Adjuntos:");

                    nota.adjuntos.forEach((link) => {
                        doc
                            .fontSize(9)
                            .fillColor("blue")
                            .text(`• ${link}`, { link, underline: true, indent: 30 });
                    });
                }

                doc.moveDown(1);
            });
        }

        doc.end();
    } catch (error) {
        console.error("Error al exportar notas clínicas:", error);
        res.status(500).json({ message: "Error al generar PDF de notas clínicas." });
    }
};
