import PDFDocument from "pdfkit";
import Transaction from "../models/Transaction.js";
import Patient from "../models/Patient.js";
import Note from "../models/Note.js";
import CashRegister from "../models/CashRegister.js";

import { inicioDelDia, finDelDia } from "../config/timezone.js";

// 🧾 Exportar transacciones en PDF filtradas por fecha
export const exportarCajaPDF = async (req, res) => {
    try {
        const { fecha } = req.query;

        if (!fecha) {
            return res.status(400).json({ message: "La fecha es obligatoria." });
        }

        const inicioDia = inicioDelDia(fecha);
        const finDia = finDelDia(fecha);

        // Buscar caja del día
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

        const doc = new PDFDocument();
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=transacciones_${fecha}.pdf`);
        doc.pipe(res);

        // Encabezado
        doc.fontSize(18).text("Reporte de Caja - MBCare", { align: "center" });
        doc.moveDown();
        doc.fontSize(12).text(`Fecha: ${fecha}`, { align: "left" });
        doc.fontSize(12).text(`Profesional: ${req.user.nombre || "N/A"}`);
        doc.moveDown();

        // Resumen financiero
        doc.fontSize(13).fillColor("black").text("Resumen del día:");
        doc.moveDown(0.2);
        doc.fontSize(11).fillColor("gray").text(`Saldo inicial: $${caja.saldoInicial}`);
        doc.fontSize(11).text(`Total ingresos: $${ingresos}`);
        doc.fontSize(11).text(`Total egresos: $${egresos}`);
        doc.fontSize(11).text(`Saldo final: $${saldoFinal}`);
        doc.moveDown();

        // Detalle de transacciones
        doc.fontSize(13).fillColor("black").text("Transacciones:");
        doc.moveDown(0.2);

        if (transacciones.length === 0) {
            doc.fontSize(11).text("No se registraron transacciones en esta fecha.");
        } else {
            transacciones.forEach((t, i) => {
                doc
                    .fontSize(11)
                    .fillColor("black")
                    .text(`${i + 1}. ${t.tipo} - $${t.monto}`);
                doc.text(`    ${t.descripcion}`);
                doc.text(`    Pago: ${t.metodoPago} | Profesional: ${t.profesional?.nombre || "N/A"}`);
                doc.moveDown();
            });
        }

        doc.end();
    } catch (error) {
        console.error("Error al exportar PDF de caja:", error);
        res.status(500).json({ message: "Error al generar PDF de caja." });
    }
};

// ✅ Exportar notas clínicas por paciente (incluye contenido y adjuntos)
export const exportarNotasClinicasPDF = async (req, res) => {
    try {
        const { numeroDocumento } = req.query;

        if (!numeroDocumento) {
            return res.status(400).json({ message: "El número de documento es obligatorio." });
        }

        const paciente = await Patient.findOne({
            numeroDocumento,
            organizacion: req.user.organizacion,
        });

        if (!paciente) {
            return res.status(404).json({ message: "Paciente no encontrado." });
        }

        const notas = await Note.find({
            paciente: paciente._id,
            organizacion: req.user.organizacion,
        })
            .populate("profesional", "nombre")
            .sort({ createdAt: -1 });

        const doc = new PDFDocument();
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=notas_clinicas_${numeroDocumento}.pdf`
        );
        doc.pipe(res);

        // Encabezado
        doc.fontSize(18).text("Reporte de Notas Clínicas - MBCare", { align: "center" });
        doc.moveDown();
        doc.fontSize(12).text(`Paciente: ${paciente.nombreCompleto}`);
        doc.fontSize(12).text(`Documento: ${paciente.tipoDocumento} ${numeroDocumento}`);
        doc.moveDown();

        if (notas.length === 0) {
            doc.text("No se encontraron notas clínicas para este paciente.");
        } else {
            notas.forEach((nota, i) => {
                doc
                    .fontSize(12)
                    .fillColor("black")
                    .text(`${i + 1}. ${nota.titulo || "Sin título"}`, { underline: true });
                doc
                    .fontSize(10)
                    .fillColor("gray")
                    .text(`Tipo: ${nota.tipoNota || "General"} | Profesional: ${nota.profesional.nombre}`);
                doc
                    .fontSize(10)
                    .fillColor("gray")
                    .text(`Fecha: ${new Date(nota.createdAt).toLocaleString("es-CO")}`);
                doc.moveDown(0.5);

                // Contenido
                doc
                    .fontSize(11)
                    .fillColor("black")
                    .text(nota.contenido, {
                        align: "left",
                        indent: 20,
                    });

                // Adjuntos
                if (Array.isArray(nota.adjuntos) && nota.adjuntos.length > 0) {
                    doc.moveDown(0.5);
                    doc
                        .fontSize(10)
                        .fillColor("blue")
                        .text("Adjuntos:", { underline: true });

                    nota.adjuntos.forEach((link, idx) => {
                        doc
                            .fontSize(9)
                            .fillColor("blue")
                            .text(`• ${link}`, {
                                link: link,
                                underline: true,
                                indent: 30,
                            });
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
