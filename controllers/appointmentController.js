import Appointment from "../models/Appointment.js";
import mongoose from "mongoose";

/**
 * 🟢 Crear una cita
 */
export const crearCita = async (req, res) => {
    try {
        const { paciente, fecha, duracion, tipo, notas } = req.body;
        const profesional = req.user._id;
        const organizacion = req.user.organizacion;

        if (!paciente || !fecha) {
            return res.status(400).json({ message: "Paciente y fecha son obligatorios." });
        }

        if (!mongoose.Types.ObjectId.isValid(paciente)) {
            return res.status(400).json({ message: "ID de paciente inválido." });
        }

        const nuevaCita = await Appointment.create({
            paciente,
            profesional,
            fecha,
            duracion,
            tipo,
            notas,
            organizacion,
        });

        res.status(201).json({
            message: "Cita creada exitosamente.",
            cita: nuevaCita,
        });
    } catch (error) {
        console.error("Error al crear cita:", error);
        res.status(500).json({ message: "Error al crear cita.", error: error.message });
    }
};

/**
 * 🔍 Obtener todas las citas de la organización con filtros
 */
export const obtenerCitasOrganizacion = async (req, res) => {
    try {
        const { paciente, desde, hasta, estado } = req.query;

        const filtro = {
            organizacion: req.user.organizacion,
        };

        if (paciente) {
            if (!mongoose.Types.ObjectId.isValid(paciente)) {
                return res.status(400).json({ message: "ID de paciente inválido." });
            }
            filtro.paciente = paciente;
        }

        if (desde || hasta) {
            filtro.fecha = {};
            if (desde) filtro.fecha.$gte = new Date(desde);
            if (hasta) filtro.fecha.$lte = new Date(hasta);
        }

        if (estado) {
            filtro.estado = estado;
        }

        const citas = await Appointment.find(filtro)
            .populate("paciente", "nombreCompleto numeroDocumento")
            .populate("profesional", "nombre email")
            .sort({ fecha: 1 });

        res.status(200).json({ citas });
    } catch (error) {
        console.error("Error al obtener citas:", error);
        res.status(500).json({ message: "Error al listar citas.", error: error.message });
    }
};

/**
 * 📝 Editar una cita existente
 */
export const editarCita = async (req, res) => {
    try {
        const { id } = req.params;
        const { fecha, duracion, tipo, notas, estado } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "ID de cita inválido." });
        }

        const cita = await Appointment.findOne({
            _id: id,
            organizacion: req.user.organizacion,
        });

        if (!cita) {
            return res.status(404).json({ message: "Cita no encontrada." });
        }

        if (fecha) cita.fecha = fecha;
        if (duracion) cita.duracion = duracion;
        if (tipo) cita.tipo = tipo;
        if (notas !== undefined) cita.notas = notas;
        if (estado) cita.estado = estado;

        await cita.save();

        res.status(200).json({
            message: "Cita actualizada correctamente.",
            cita,
        });
    } catch (error) {
        console.error("Error al editar cita:", error);
        res.status(500).json({ message: "Error al editar la cita.", error: error.message });
    }
};

/**
 * ❌ Cancelar una cita
 */
export const cancelarCita = async (req, res) => {
    try {
        const { id } = req.params;
        const { notas } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "ID de cita inválido." });
        }

        const cita = await Appointment.findOne({
            _id: id,
            organizacion: req.user.organizacion,
        });

        if (!cita) {
            return res.status(404).json({ message: "Cita no encontrada." });
        }

        if (cita.estado === "Cancelada") {
            return res.status(400).json({ message: "La cita ya fue cancelada." });
        }

        cita.estado = "Cancelada";
        if (notas) cita.notas = notas;

        await cita.save();

        res.status(200).json({
            message: "Cita cancelada exitosamente.",
            cita,
        });
    } catch (error) {
        console.error("Error al cancelar cita:", error);
        res.status(500).json({ message: "Error al cancelar la cita.", error: error.message });
    }
};

/**
 * 📤 Exportar resumen de citas
 */
export const exportarCitas = async (req, res) => {
    try {
        const { desde, hasta, estado } = req.query;

        const filtro = {
            organizacion: req.user.organizacion,
        };

        if (desde || hasta) {
            filtro.fecha = {};
            if (desde) filtro.fecha.$gte = new Date(desde);
            if (hasta) filtro.fecha.$lte = new Date(hasta);
        }

        if (estado) {
            filtro.estado = estado;
        }

        const citas = await Appointment.find(filtro)
            .populate("paciente", "nombreCompleto numeroDocumento")
            .populate("profesional", "nombre")
            .sort({ fecha: 1 });

        const resumen = citas.map((cita) => ({
            paciente: cita.paciente?.nombreCompleto,
            documento: cita.paciente?.numeroDocumento,
            profesional: cita.profesional?.nombre,
            fecha: cita.fecha,
            duracion: cita.duracion,
            tipo: cita.tipo,
            estado: cita.estado,
        }));

        res.status(200).json({ resumen });
    } catch (error) {
        console.error("Error al exportar citas:", error);
        res.status(500).json({ message: "Error al exportar citas.", error: error.message });
    }
};
