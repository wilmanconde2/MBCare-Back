import Attachment from "../models/Attachment.js";
import { subirArchivoFilebase, eliminarArchivoFilebase } from "../services/filebaseService.js";

/**
 * 📤 Subir archivo clínico
 * Fundador / Profesional / Asistente → permitido
 * Profesional siempre queda como autor del adjunto
 */
export const subirAdjunto = async (req, res) => {
    try {
        const { paciente, descripcion } = req.body;

        if (!paciente || !req.file) {
            return res.status(400).json({ message: "Paciente y archivo son obligatorios." });
        }

        const filebaseFile = await subirArchivoFilebase(req.file);

        const adjunto = await Attachment.create({
            paciente,
            profesional: req.user._id, // autor
            organizacion: req.user.organizacion,
            url: filebaseFile.url,
            public_id: filebaseFile.public_id,
            descripcion,
            tipo: filebaseFile.tipo,
        });

        res.status(201).json({
            message: "Adjunto clínico guardado exitosamente.",
            adjunto,
        });
    } catch (error) {
        console.error("Error al subir adjunto:", error);
        res.status(500).json({ message: "Error al guardar adjunto." });
    }
};

/**
 * 🔍 Obtener adjuntos de un paciente
 * Fundador → ve todo
 * Asistente → ve todo
 * Profesional → solo ve los suyos (sus adjuntos)
 */
export const obtenerAdjuntosPorPaciente = async (req, res) => {
    try {
        const { pacienteId } = req.params;

        const filtro = {
            paciente: pacienteId,
            organizacion: req.user.organizacion,
        };

        // Profesional → solo sus adjuntos
        if (req.user.rol === "Profesional") {
            filtro.profesional = req.user._id;
        }

        const adjuntos = await Attachment.find(filtro)
            .populate("profesional", "nombre email")
            .sort({ createdAt: -1 });

        res.status(200).json({ adjuntos });
    } catch (error) {
        console.error("Error al obtener adjuntos:", error);
        res.status(500).json({ message: "Error al obtener adjuntos clínicos." });
    }
};

/**
 * 🗑️ Eliminar adjunto clínico
 * Fundador → puede eliminar
 * Profesional → solo si es autor
 * Asistente → NO puede eliminar
 */
export const eliminarAdjunto = async (req, res) => {
    try {
        const { id } = req.params;

        const adjunto = await Attachment.findById(id);

        if (!adjunto || adjunto.organizacion.toString() !== req.user.organizacion.toString()) {
            return res.status(404).json({ message: "Adjunto no encontrado." });
        }

        const esFundador = req.user.rol === "Fundador";
        const esAutor = adjunto.profesional.toString() === req.user._id.toString();

        // ❌ Asistente NO puede eliminar nada
        if (req.user.rol === "Asistente") {
            return res.status(403).json({ message: "No tienes permiso para eliminar adjuntos." });
        }

        // Profesional solo puede borrar sus propios adjuntos
        if (!esFundador && !esAutor) {
            return res.status(403).json({ message: "No tienes permisos para eliminar este adjunto." });
        }

        await eliminarArchivoFilebase(adjunto.public_id);
        await adjunto.deleteOne();

        res.status(200).json({ message: "Adjunto eliminado exitosamente." });
    } catch (error) {
        console.error("Error al eliminar adjunto:", error);
        res.status(500).json({ message: "Error al eliminar adjunto." });
    }
};
