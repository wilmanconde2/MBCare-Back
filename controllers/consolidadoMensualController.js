import ConsolidadoMensual from "../models/ConsolidadoMensual.js";
import ResumenCaja from "../models/ResumenCaja.js";
import moment from "moment-timezone";
import "moment/locale/es.js";
import PDFDocument from "pdfkit";
import { auditar } from "../utils/auditar.js";

moment.locale("es");

/**
 * 📊 Generar consolidado mensual
 * Solo Fundador puede generar consolidado (ruta y backend lo verifican)
 */
export const generarResumenMensual = async (req, res) => {
    try {
        if (req.user.rol !== "Fundador") {
            return res.status(403).json({ message: "Solo el Fundador puede generar el consolidado mensual." });
        }

        const { mes } = req.query;

        if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
            return res.status(400).json({ message: "El parámetro mes debe tener el formato YYYY-MM." });
        }

        const [anio, mesStr] = mes.split("-");
        const numeroMes = Number(mesStr);
        const numeroAnio = Number(anio);

        // Buscar consolidado existente
        const existente = await ConsolidadoMensual.findOne({
            mes: numeroMes,
            anio: numeroAnio,
            organizacion: req.user.organizacion,
        });

        // Fechas del mes a recalcular
        const fechaInicioMes = moment
            .tz(`${anio}-${mesStr}-01`, "America/Bogota")
            .startOf("month")
            .toDate();

        const fechaFinMes = moment
            .tz(fechaInicioMes, "America/Bogota")
            .endOf("month")
            .toDate();

        const resumenes = await ResumenCaja.find({
            fecha: { $gte: fechaInicioMes, $lte: fechaFinMes },
            organizacion: req.user.organizacion,
        });

        const ingresosTotales = resumenes.reduce((acc, r) => acc + r.ingresosTotales, 0);
        const egresosTotales = resumenes.reduce((acc, r) => acc + r.egresosTotales, 0);
        const saldoInicial = resumenes.length > 0 ? resumenes[0].saldoInicial : 0;
        const saldoFinal = saldoInicial + ingresosTotales - egresosTotales;

        // ⛔ SI EXISTE → actualizarlo en vez de devolver viejo
        if (existente) {
            existente.ingresosTotales = ingresosTotales;
            existente.egresosTotales = egresosTotales;
            existente.saldoInicial = saldoInicial;
            existente.saldoFinal = saldoFinal;
            existente.ultimaActualizacion = new Date();
            await existente.save();

            return res.status(200).json({
                message: "Consolidado actualizado correctamente.",
                consolidado: existente,
            });
        }

        // Crear consolidado nuevo
        const consolidado = await ConsolidadoMensual.create({
            mes: numeroMes,
            anio: numeroAnio,
            organizacion: req.user.organizacion,
            ingresosTotales,
            egresosTotales,
            saldoInicial,
            saldoFinal,
            creadoPor: req.user._id,
        });

        await auditar(req, "GENERAR_CONSOLIDADO_MENSUAL", {
            mes,
            ingresosTotales,
            egresosTotales,
            saldoInicial,
            saldoFinal
        });

        res.status(201).json({
            message: "Consolidado generado exitosamente.",
            consolidado
        });

    } catch (error) {
        console.error("Error al generar consolidado mensual:", error);
        res.status(500).json({ message: "Error al generar consolidado mensual." });
    }
};


/**
 * 🧾 Exportar consolidado mensual en PDF
 * Solo Fundador puede exportar
 */
export const exportarResumenMensualPDF = async (req, res) => {
    try {
        if (req.user.rol !== "Fundador") {
            return res
                .status(403)
                .json({ message: "Solo el Fundador puede exportar el consolidado mensual." });
        }

        const { mes } = req.query;

        if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
            return res.status(400).json({
                message: "El parámetro 'mes' debe tener el formato YYYY-MM."
            });
        }

        const [anio, mesStr] = mes.split("-");
        const numeroMes = parseInt(mesStr);
        const numeroAnio = parseInt(anio);

        const consolidado = await ConsolidadoMensual.findOne({
            mes: numeroMes,
            anio: numeroAnio,
            organizacion: req.user.organizacion,
        }).populate("creadoPor", "nombre email");

        if (!consolidado) {
            return res.status(404).json({ message: "No hay consolidado para ese mes." });
        }

        await auditar(req, "EXPORTAR_CONSOLIDADO_PDF", {
            mes,
            consolidadoId: consolidado._id
        });

        const doc = new PDFDocument({ margin: 50 });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=consolidado_${mes}.pdf`
        );
        doc.pipe(res);

        const mesFormateado = moment(`${mes}-01`).format("MMMM [de] YYYY");
        const mesCapitalizado =
            mesFormateado.charAt(0).toUpperCase() + mesFormateado.slice(1);

        doc.fontSize(20).text("Consolidado Mensual de Caja - MBCare", { align: "center" });
        doc.moveDown();

        doc.fontSize(14).text(`Mes: ${mesCapitalizado}`);
        doc.fontSize(10).text(`Generado por: ${consolidado.creadoPor?.nombre || "Usuario"}`);
        doc.text(`Fecha de generación: ${moment().tz("America/Bogota").format("DD/MM/YYYY HH:mm")}`);
        doc.moveDown(1.5);

        doc.fontSize(12).text(`Saldo inicial del mes: $${consolidado.saldoInicial.toLocaleString()}`);
        doc.text(`Ingresos del mes:      $${consolidado.ingresosTotales.toLocaleString()}`);
        doc.text(`Egresos del mes:       $${consolidado.egresosTotales.toLocaleString()}`);
        doc.text(`Saldo final:           $${consolidado.saldoFinal.toLocaleString()}`);
        doc.moveDown(1.5);

        doc.fontSize(11)
            .fillColor("gray")
            .text(
                "Este consolidado incluye el total de ingresos y egresos diarios registrados a través del módulo de Caja.",
                { align: "justify" }
            );

        doc.moveDown();
        doc.fillColor("gray").text(
            "Se recomienda guardar este archivo como respaldo contable mensual.",
            { align: "justify" }
        );

        doc.end();

    } catch (error) {
        console.error("Error al exportar consolidado mensual en PDF:", error);
        res.status(500).json({ message: "Error al generar PDF del consolidado mensual." });
    }
};
