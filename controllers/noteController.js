// ✅ controllers/noteController.js

import Note from "../models/Note.js";
import mongoose from "mongoose";

/**
 * 📝 Crear una nueva nota clínica
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
 * 📋 Listar todas las notas clínicas de un paciente
 */
export const obtenerNotasPorPaciente = async (req, res) => {
    try {
        const { pacienteId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(pacienteId)) {
            return res.status(400).json({ message: "ID de paciente inválido." });
        }

        const notas = await Note.find({
            paciente: pacienteId,
            organizacion: req.user.organizacion,
        })
            .populate("profesional", "nombre email")
            .sort({ createdAt: -1 });

        res.status(200).json({ notas });
    } catch (error) {
        console.error("Error al obtener notas:", error);
        res.status(500).json({ message: "Error al obtener notas clínicas.", error: error.message });
    }
};

/**
 * 🔍 Obtener una nota por ID
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

        res.status(200).json({ nota });
    } catch (error) {
        console.error("Error al obtener nota por ID:", error);
        res.status(500).json({ message: "Error al obtener nota.", error: error.message });
    }
};

/**
 * 📝 Editar una nota clínica existente
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
        const esAutor = nota.profesional.toString() === req.user._id.toString();

        if (!esFundador && !esAutor) {
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
