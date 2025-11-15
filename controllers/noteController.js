import Note from "../models/Note.js";
import mongoose from "mongoose";
import Patient from "../models/Patient.js";

/**
 * 📝 Crear una nueva nota clínica
 * Fundador, Profesional y Asistente pueden crear
 * Profesional siempre se asigna a sí mismo
 */
export const crearNota = async (req, res) => {
    try {
        const { paciente, titulo, contenido, tipoNota, adjuntos } = req.body;
        const profesional = req.user._id;
        const organizacion = req.user.organizacion;

        if (!paciente || !contenido) {
            return res.status(400).json({ message: "Paciente y contenido son obligatorios." });
        }

        if (!mongoose.Types.ObjectId.isValid(paciente)) {
            return res.status(400).json({ message: "ID de paciente inválido." });
        }

        const nuevaNota = await Note.create({
            paciente,
            profesional,
            organizacion,
            titulo,
            contenido,
            tipoNota,
            adjuntos,
        });

        res.status(201).json({
            message: "Nota clínica creada exitosamente.",
            nota: nuevaNota,
        });
    } catch (error) {
        console.error("Error al crear nota:", error);
        res.status(500).json({ message: "Error al crear nota.", error: error.message });
    }
};

/**
 * 📋 Listar todas las notas clínicas de un paciente (por ObjectId)
 * Fundador → todas
 * Asistente → todas
 * Profesional → SOLO SUS notas
 */
export const obtenerNotasPorPaciente = async (req, res) => {
    try {
        const { pacienteId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(pacienteId)) {
            return res.status(400).json({ message: "ID de paciente inválido." });
        }

        const filtro = {
            paciente: pacienteId,
            organizacion: req.user.organizacion,
        };

        // Profesional solo puede ver sus notas
        if (req.user.rol === "Profesional") {
            filtro.profesional = req.user._id;
        }

        const notas = await Note.find(filtro)
            .populate("profesional", "nombre email")
            .sort({ createdAt: -1 });

        res.status(200).json({ notas });
    } catch (error) {
        console.error("Error al obtener notas:", error);
        res.status(500).json({ message: "Error al obtener notas clínicas.", error: error.message });
    }
};

/**
 * 📋 Obtener notas por número de documento (validando organización)
 * Fundador → todas
 * Asistente → todas
 * Profesional → solo sus notas
 */
export const obtenerNotasPorDocumento = async (req, res) => {
    try {
        const { numeroDocumento } = req.params;

        if (!numeroDocumento) {
            return res.status(400).json({ message: "El número de documento es obligatorio." });
        }

        const paciente = await Patient.findOne({
            numeroDocumento,
            organizacion: req.user.organizacion,
        });

        if (!paciente) {
            return res.status(404).json({ message: "Paciente no encontrado en esta organización." });
        }

        const filtro = {
            paciente: paciente._id,
            organizacion: req.user.organizacion,
        };

        // Profesional solo ve sus notas
        if (req.user.rol === "Profesional") {
            filtro.profesional = req.user._id;
        }

        const notas = await Note.find(filtro)
            .populate("profesional", "nombre email")
            .sort({ createdAt: -1 });

        res.status(200).json({ notas });
    } catch (error) {
        console.error("Error al obtener notas por documento:", error);
        res.status(500).json({ message: "Error al obtener notas clínicas.", error: error.message });
    }
};

/**
 * 🔍 Obtener una nota por ID
 * Fundador → puede ver
 * Asistente → puede ver
 * Profesional → solo sus notas
 */
export const obtenerNotaPorId = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "ID de nota inválido." });
        }

        const nota = await Note.findOne({
            _id: id,
            organizacion: req.user.organizacion,
        }).populate("profesional", "nombre email");

        if (!nota) {
            return res.status(404).json({ message: "Nota no encontrada." });
        }

        // Profesional solo puede ver sus notas
        if (req.user.rol === "Profesional" && nota.profesional.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "No tienes permisos para ver esta nota." });
        }

        res.status(200).json({ nota });
    } catch (error) {
        console.error("Error al obtener nota por ID:", error);
        res.status(500).json({ message: "Error al obtener nota.", error: error.message });
    }
};

/**
 * 📝 Editar una nota clínica existente
 * Fundador → todas
 * Asistente → todas
 * Profesional → solo sus notas
 */
export const editarNota = async (req, res) => {
    try {
        const { id } = req.params;
        const { titulo, contenido, tipoNota, adjuntos } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "ID de nota inválido." });
        }

        const nota = await Note.findById(id);

        if (!nota || nota.organizacion.toString() !== req.user.organizacion.toString()) {
            return res.status(404).json({ message: "Nota no encontrada." });
        }

        const esFundador = req.user.rol === "Fundador";
        const esAsistente = req.user.rol === "Asistente";
        const esAutor = nota.profesional.toString() === req.user._id.toString();

        // Profesional: solo edita sus notas
        // Asistente: puede editar todas
        if (!esFundador && !esAsistente && !esAutor) {
            return res.status(403).json({ message: "No tienes permisos para editar esta nota." });
        }

        if (titulo !== undefined) nota.titulo = titulo;
        if (contenido !== undefined) nota.contenido = contenido;
        if (tipoNota !== undefined) nota.tipoNota = tipoNota;
        if (adjuntos !== undefined) nota.adjuntos = adjuntos;

        await nota.save();

        res.status(200).json({
            message: "Nota actualizada exitosamente.",
            nota,
        });
    } catch (error) {
        console.error("Error al editar nota:", error);
        res.status(500).json({ message: "Error al editar nota.", error: error.message });
    }
};

/**
 * 🗑️ Eliminar una nota clínica
 * Fundador → puede eliminar
 * Profesional → solo si es suya
 * Asistente → NO puede eliminar
 */
export const eliminarNota = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "ID de nota inválido." });
        }

        const nota = await Note.findById(id);

        if (!nota || nota.organizacion.toString() !== req.user.organizacion.toString()) {
            return res.status(404).json({ message: "Nota no encontrada." });
        }

        const esFundador = req.user.rol === "Fundador";
        const esAutor = nota.profesional.toString() === req.user._id.toString();

        // Asistente nunca puede eliminar
        if (req.user.rol === "Asistente") {
            return res.status(403).json({ message: "No tienes permiso para eliminar notas." });
        }

        // Profesional solo elimina sus notas
        if (!esFundador && !esAutor) {
            return res.status(403).json({ message: "No tienes permisos para eliminar esta nota." });
        }

        await nota.deleteOne();

        res.status(200).json({ message: "Nota clínica eliminada exitosamente." });
    } catch (error) {
        console.error("Error al eliminar nota:", error);
        res.status(500).json({ message: "Error al eliminar nota.", error: error.message });
    }
};
