import Appointment from "../models/Appointment.js";
import mongoose from "mongoose";

/**
 * Crear cita
 * - Fundador / Asistente: pueden asignar cualquier profesional (o a sí mismos)
 * - Profesional: siempre se asigna a sí mismo
 */
export const crearCita = async (req, res) => {
    try {
        const {
            paciente,
            fecha,
            duracion,
            tipo,
            notas,
            profesional: profesionalId,
        } = req.body;

        const organizacion = req.user.organizacion;

        if (!paciente || !fecha) {
            return res
                .status(400)
                .json({ message: "Paciente y fecha son obligatorios." });
        }

        if (!mongoose.Types.ObjectId.isValid(paciente)) {
            return res.status(400).json({ message: "ID de paciente inválido." });
        }

        let profesional;

        if (req.user.rol === "Profesional") {
            // Profesional siempre se asigna a sí mismo
            profesional = req.user._id;
        } else {
            // Fundador / Asistente pueden asignar cualquier profesional
            if (profesionalId && !mongoose.Types.ObjectId.isValid(profesionalId)) {
                return res
                    .status(400)
                    .json({ message: "ID de profesional inválido." });
            }
            profesional = profesionalId || req.user._id;
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
        res
            .status(500)
            .json({ message: "Error al crear cita.", error: error.message });
    }
};

/**
 * Listar citas por organización con filtros
 * - Fundador / Asistente: ven todas
 * - Profesional: solo sus citas
 */
export const obtenerCitasOrganizacion = async (req, res) => {
    try {
        const { paciente, desde, hasta, estado } = req.query;

        const filtro = {
            organizacion: req.user.organizacion,
        };

        if (req.user.rol === "Profesional") {
            filtro.profesional = req.user._id;
        }

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
        res
            .status(500)
            .json({ message: "Error al listar citas.", error: error.message });
    }
};

/**
 * Editar cita
 * - Fundador / Asistente: pueden editar todo, incluido paciente y profesional
 * - Profesional: solo puede editar sus propias citas y no puede cambiar paciente/profesional
 */
export const editarCita = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            fecha,
            duracion,
            tipo,
            notas,
            estado,
            paciente,
            profesional,
        } = req.body;

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

        // Profesional solo edita sus propias citas
        if (
            req.user.rol === "Profesional" &&
            cita.profesional.toString() !== req.user._id.toString()
        ) {
            return res
                .status(403)
                .json({ message: "No tienes permisos para editar esta cita." });
        }

        // Actualizar paciente solo si es Fundador / Asistente
        if (
            paciente &&
            (req.user.rol === "Fundador" || req.user.rol === "Asistente")
        ) {
            if (!mongoose.Types.ObjectId.isValid(paciente)) {
                return res.status(400).json({ message: "ID de paciente inválido." });
            }
            cita.paciente = paciente;
        }

        // Actualizar profesional solo si es Fundador / Asistente
        if (
            profesional &&
            (req.user.rol === "Fundador" || req.user.rol === "Asistente")
        ) {
            if (!mongoose.Types.ObjectId.isValid(profesional)) {
                return res.status(400).json({ message: "ID de profesional inválido." });
            }
            cita.profesional = profesional;
        }

        // Campos comunes
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
        res
            .status(500)
            .json({ message: "Error al editar la cita.", error: error.message });
    }
};

/**
 * Cancelar cita
 * - Fundador / Asistente: pueden cancelar todas
 * - Profesional: solo sus citas
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

        if (
            req.user.rol === "Profesional" &&
            cita.profesional.toString() !== req.user._id.toString()
        ) {
            return res
                .status(403)
                .json({ message: "No tienes permisos para cancelar esta cita." });
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
        res
            .status(500)
            .json({ message: "Error al cancelar la cita.", error: error.message });
    }
};

/**
 * Exportar resumen de citas
 * - Fundador / Asistente: pueden exportar
 * - Profesional: solo sus citas
 */
export const exportarCitas = async (req, res) => {
    try {
        const { desde, hasta, estado } = req.query;

        const filtro = {
            organizacion: req.user.organizacion,
        };

        if (req.user.rol === "Profesional") {
            filtro.profesional = req.user._id;
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
        res
            .status(500)
            .json({ message: "Error al exportar citas.", error: error.message });
    }
};
