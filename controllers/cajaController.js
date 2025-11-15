import CashRegister from "../models/CashRegister.js";
import Transaction from "../models/Transaction.js";
import ResumenCaja from "../models/ResumenCaja.js";
import { inicioDelDia, finDelDia, fechaActual } from "../config/timezone.js";
import moment from "moment-timezone";
import PDFDocument from "pdfkit";

// 🟦 Abrir Caja del Día
export const abrirCaja = async (req, res) => {
    try {
        const { saldoInicial } = req.body;

        if (typeof saldoInicial !== "number" || saldoInicial < 0) {
            return res.status(400).json({ message: "El valor de apertura es requerido y debe ser válido." });
        }

        const hoyInicio = inicioDelDia();
        const hoyFin = finDelDia();

        const existeCajaHoy = await CashRegister.findOne({
            fecha: { $gte: hoyInicio, $lte: hoyFin },
            profesional: req.user._id,
            organizacion: req.user.organizacion,
            abierta: true,
        });

        if (existeCajaHoy) {
            return res.status(400).json({ message: "Ya hay una caja abierta para hoy." });
        }

        const nuevaCaja = await CashRegister.create({
            saldoInicial,
            profesional: req.user._id,
            organizacion: req.user.organizacion,
            abierta: true,
            fecha: hoyInicio,
        });

        res.status(201).json({
            message: "Caja del día abierta exitosamente.",
            caja: nuevaCaja,
        });
    } catch (error) {
        console.error("Error al abrir caja:", error);
        res.status(500).json({ message: "Error del servidor al abrir caja." });
    }
};

// 🔒 Cerrar Caja del Día
export const cerrarCaja = async (req, res) => {
    try {
        const hoyInicio = inicioDelDia();
        const hoyFin = finDelDia();

        const caja = await CashRegister.findOne({
            fecha: { $gte: hoyInicio, $lte: hoyFin },
            profesional: req.user._id,
            organizacion: req.user.organizacion,
            abierta: true,
        });

        if (!caja) {
            return res.status(404).json({ message: "No hay una caja abierta para hoy." });
        }

        // Transacciones del día (solo las de esta caja)
        const transacciones = await Transaction.find({
            caja: caja._id,
            organizacion: req.user.organizacion,
        });

        const totalIngresos = transacciones
            .filter(t => t.tipo === "Ingreso")
            .reduce((acc, t) => acc + t.monto, 0);

        const totalEgresos = transacciones
            .filter(t => t.tipo === "Egreso")
            .reduce((acc, t) => acc + t.monto, 0);

        const saldoFinal = caja.saldoInicial + totalIngresos - totalEgresos;

        // Marcar como cerrada y guardar saldo final
        caja.abierta = false;
        caja.saldoFinal = saldoFinal;
        await caja.save();

        // 🧾 Crear resumen de caja automáticamente si no existe
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
                creadoPor: req.user._id,
            });
        }

        res.status(200).json({
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
        res.status(500).json({ message: "Error del servidor al cerrar caja." });
    }
};


// 📁 Listar historial de cajas cerradas
export const historialCajas = async (req, res) => {
    try {
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

        const total = await CashRegister.countDocuments(filtros);

        res.status(200).json({
            total,
            paginaActual: parseInt(page),
            totalPaginas: Math.ceil(total / limit),
            cajas,
        });
    } catch (error) {
        console.error("Error al listar historial de cajas:", error);
        res.status(500).json({ message: "Error al obtener historial de cajas." });
    }
};

// 📤 Exportar historial en PDF
export const exportarHistorialCajaPDF = async (req, res) => {
    try {
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

        if (req.user.rol === "Fundador" && profesionalId) {
            filtros.profesional = profesionalId;
        }

        const cajas = await CashRegister.find(filtros)
            .populate("profesional", "nombre email")
            .sort({ fecha: -1 });

        const doc = new PDFDocument();
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=historial_cajas.pdf`);
        doc.pipe(res);

        doc.fontSize(18).text("Historial Cuadre Diario - MBCare", { align: "center" });
        doc.moveDown();

        if (cajas.length === 0) {
            doc.fontSize(12).text("No se encontraron cajas cerradas con los filtros proporcionados.");
        } else {
            let totalIngresos = 0;
            let totalEgresos = 0;
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
        res.status(500).json({ message: "Error al generar PDF del historial de cajas." });
    }
};
