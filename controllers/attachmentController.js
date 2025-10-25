import Attachment from "../models/Attachment.js";
import cloudinary from "../config/cloudinary.js";

/**
 * 📤 Subir archivo clínico a Cloudinary y guardar referencia en la BD
 */
export const subirAdjunto = async (req, res) => {
    try {
        const { paciente, descripcion } = req.body;

        if (!paciente || !req.file) {
            return res.status(400).json({ message: "Paciente y archivo son obligatorios." });
        }

        // 🧾 Depuración extendida
        console.log("🔍 req.file recibido:", req.file);

        // ✅ Asegurarse de usar la info correcta según tipo de archivo
        const url = req.file?.path || req.file?.url || "";
        const public_id = req.file?.filename || req.file?.public_id || "";
        const mimetype = req.file.mimetype;

        if (!url || !public_id) {
            throw new Error("Cloudinary no devolvió URL o public_id");
        }

        console.log("🔍 req.file recibido:", JSON.stringify(req.file, null, 2));


        const adjunto = await Attachment.create({
            paciente,
            profesional: req.user._id,
            organizacion: req.user.organizacion,
            url,
            public_id,
            descripcion,
            tipo: mimetype,
        });

        res.status(201).json({
            message: "Adjunto clínico guardado exitosamente.",
            adjunto,
        });
    } catch (error) {
        console.error("❌ Error completo:", error);

        // 🔍 Si viene de Cloudinary con más detalles
        if (error.response && error.response.body) {
            console.error("📄 Cloudinary Response Body:", error.response.body);
        }

        const mensaje =
            error instanceof Error
                ? error.message
                : "Error desconocido al subir el archivo.";

        res.status(500).json({ message: mensaje });
    }

};

/**
 * 🔍 Obtener todos los adjuntos clínicos de un paciente
 */
export const obtenerAdjuntosPorPaciente = async (req, res) => {
    try {
        const { pacienteId } = req.params;

        const adjuntos = await Attachment.find({
            paciente: pacienteId,
            organizacion: req.user.organizacion,
        })
            .populate("profesional", "nombre email")
            .sort({ createdAt: -1 });

        res.status(200).json({ adjuntos });
    } catch (error) {
        console.error("Error al obtener adjuntos:", error);
        res.status(500).json({ message: "Error al obtener adjuntos clínicos." });
    }
};

/**
 * 🗑️ Eliminar adjunto clínico (Fundador o autor)
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

        if (!esFundador && !esAutor) {
            return res.status(403).json({ message: "No tienes permisos para eliminar este adjunto." });
        }

        console.log("🔍 Public ID a eliminar:", adjunto.public_id);
        console.log("📁 Tipo detectado:", adjunto.tipo);

        // ✅ Determinar el tipo de recurso correctamente
        let resourceType = "raw";

        if (adjunto.tipo.startsWith("image/")) {
            resourceType = "image";
        } else if (adjunto.tipo.startsWith("video/")) {
            resourceType = "video";
        } else if (adjunto.tipo === "application/pdf") {
            resourceType = "image"; // Cloudinary lo guarda como image casi siempre
        }

        console.log("🗑️ Eliminando en Cloudinary con tipo:", resourceType);

        const resultado = await cloudinary.uploader.destroy(adjunto.public_id, {
            resource_type: resourceType,
        });

        console.log("✅ Resultado Cloudinary:", resultado);

        await adjunto.deleteOne();

        res.status(200).json({
            message: "Adjunto eliminado exitosamente!",
            resultado,
        });
    } catch (error) {
        console.error("Error al eliminar adjunto:", error);
        res.status(500).json({ message: "Error al eliminar adjunto.", error: error.message });
    }
};
