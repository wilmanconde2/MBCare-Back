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
        const {
            paciente,

            // ✅ nuevos campos
            fechaSesion,
            observaciones,
            diagnostico,
            planTratamiento,

            // legacy
            titulo,
            contenido,
            tipoNota,
            adjuntos,
        } = req.body;

        const userId = req.user?._id || req.user?.id;
        const orgId = req.user?.organizacion;

        if (!userId) {
            return res.status(401).json({ message: "Usuario no autenticado." });
        }

        if (!orgId) {
            return res.status(400).json({ message: "Organización no encontrada en el token." });
        }

        if (!paciente) {
            return res.status(400).json({ message: "Paciente es obligatorio." });
        }

        if (!mongoose.Types.ObjectId.isValid(paciente)) {
            return res.status(400).json({ message: "ID de paciente inválido." });
        }

        // ✅ Validación mínima real para notas nuevas:
        const tieneClinico =
            (observaciones && String(observaciones).trim()) ||
            (diagnostico && String(diagnostico).trim()) ||
            (planTratamiento && String(planTratamiento).trim());

        const tieneLegacy = contenido && String(contenido).trim();

        if (!tieneClinico && !tieneLegacy) {
            return res.status(400).json({
                message:
                    "La nota no puede estar vacía. Ingresa Observaciones, Diagnóstico, Plan de tratamiento o contenido.",
            });
        }

        // ✅ Parse fechaSesion (si viene), si no => ahora
        let fechaSesionParsed = new Date();
        if (fechaSesion) {
            const d = new Date(fechaSesion);
            if (isNaN(d.getTime())) {
                return res.status(400).json({ message: "Fecha de sesión inválida." });
            }
            fechaSesionParsed = d;
        }

        const nuevaNota = await Note.create({
            paciente,
            profesional: userId,
            organizacion: orgId,

            fechaSesion: fechaSesionParsed,
            observaciones: observaciones || "",
            diagnostico: diagnostico || "",
            planTratamiento: planTratamiento || "",

            // legacy guardado también (por compat)
            titulo: titulo || "",
            contenido: contenido || "",
            tipoNota: tipoNota || "",
            adjuntos: Array.isArray(adjuntos) ? adjuntos : [],
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
 * 📋 Obtener notas por número de documento (validando organización)
 * Fundador → todas
 * Asistente → todas
 * Profesional → solo sus notas
 */
export const obtenerNotasPorDocumento = async (req, res) => {
    try {
        const { numeroDocumento } = req.params;

        const userId = req.user?._id || req.user?.id;
        const orgId = req.user?.organizacion;

        if (!userId) {
            return res.status(401).json({ message: "Usuario no autenticado." });
        }

        if (!orgId) {
            return res.status(400).json({ message: "Organización no encontrada en el token." });
        }

        if (!numeroDocumento) {
            return res.status(400).json({ message: "El número de documento es obligatorio." });
        }

        const paciente = await Patient.findOne({
            numeroDocumento,
            organizacion: orgId,
        });

        if (!paciente) {
            return res.status(404).json({ message: "Paciente no encontrado en esta organización." });
        }

        const filtro = {
            paciente: paciente._id,
            organizacion: orgId,
        };

        // Profesional solo ve sus notas
        if (req.user.rol === "Profesional") {
            filtro.profesional = userId;
        }

        const notas = await Note.find(filtro)
            .populate("profesional", "nombre email")
            .populate("paciente", "nombreCompleto numeroDocumento")
            .sort({ fechaSesion: -1, createdAt: -1 });

        res.status(200).json({ notas, paciente });
    } catch (error) {
        console.error("Error al obtener notas por documento:", error);
        res.status(500).json({ message: "Error al obtener notas clínicas.", error: error.message });
    }
};

/**
 * 🔍 Obtener una nota por ID
 */
export const obtenerNotaPorId = async (req, res) => {
    try {
        const { id } = req.params;

        const userId = req.user?._id || req.user?.id;
        const orgId = req.user?.organizacion;

        if (!userId) {
            return res.status(401).json({ message: "Usuario no autenticado." });
        }

        if (!orgId) {
            return res.status(400).json({ message: "Organización no encontrada en el token." });
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "ID de nota inválido." });
        }

        const nota = await Note.findOne({
            _id: id,
            organizacion: orgId,
        })
            .populate("profesional", "nombre email")
            .populate("paciente", "nombreCompleto numeroDocumento");

        if (!nota) {
            return res.status(404).json({ message: "Nota no encontrada." });
        }

        // Profesional solo puede ver sus notas
        const esAutor = String(nota.profesional) === String(userId);
        if (req.user.rol === "Profesional" && !esAutor) {
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
 */
export const editarNota = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            // nuevos campos
            fechaSesion,
            observaciones,
            diagnostico,
            planTratamiento,

            // legacy
            titulo,
            contenido,
            tipoNota,
            adjuntos,
            paciente, // opcional: si permites cambiar paciente (si no, lo ignoras)
        } = req.body;

        const userId = req.user?._id || req.user?.id;
        const orgId = req.user?.organizacion;

        if (!userId) {
            return res.status(401).json({ message: "Usuario no autenticado." });
        }

        if (!orgId) {
            return res.status(400).json({ message: "Organización no encontrada en el token." });
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "ID de nota inválido." });
        }

        const nota = await Note.findById(id);

        if (!nota || String(nota.organizacion) !== String(orgId)) {
            return res.status(404).json({ message: "Nota no encontrada." });
        }

        const esFundador = req.user.rol === "Fundador";
        const esAsistente = req.user.rol === "Asistente";
        const esAutor = String(nota.profesional) === String(userId);

        // Profesional: solo edita sus notas
        // Asistente: puede editar todas
        if (!esFundador && !esAsistente && !esAutor) {
            return res.status(403).json({ message: "No tienes permisos para editar esta nota." });
        }

        // Cambiar paciente (si lo quieres permitir)
        if (paciente !== undefined) {
            if (!mongoose.Types.ObjectId.isValid(paciente)) {
                return res.status(400).json({ message: "ID de paciente inválido." });
            }
            nota.paciente = paciente;
        }

        // fechaSesion
        if (fechaSesion !== undefined) {
            const d = new Date(fechaSesion);
            if (isNaN(d.getTime())) {
                return res.status(400).json({ message: "Fecha de sesión inválida." });
            }
            nota.fechaSesion = d;
        }

        // nuevos campos
        if (observaciones !== undefined) nota.observaciones = observaciones || "";
        if (diagnostico !== undefined) nota.diagnostico = diagnostico || "";
        if (planTratamiento !== undefined) nota.planTratamiento = planTratamiento || "";

        // legacy
        if (titulo !== undefined) nota.titulo = titulo || "";
        if (contenido !== undefined) nota.contenido = contenido || "";
        if (tipoNota !== undefined) nota.tipoNota = tipoNota || "";
        if (adjuntos !== undefined) nota.adjuntos = Array.isArray(adjuntos) ? adjuntos : [];

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

        const userId = req.user?._id || req.user?.id;
        const orgId = req.user?.organizacion;

        if (!userId) {
            return res.status(401).json({ message: "Usuario no autenticado." });
        }

        if (!orgId) {
            return res.status(400).json({ message: "Organización no encontrada en el token." });
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "ID de nota inválido." });
        }

        const nota = await Note.findById(id);

        if (!nota || String(nota.organizacion) !== String(orgId)) {
            return res.status(404).json({ message: "Nota no encontrada." });
        }

        const esFundador = req.user.rol === "Fundador";
        const esAutor = String(nota.profesional) === String(userId);

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
