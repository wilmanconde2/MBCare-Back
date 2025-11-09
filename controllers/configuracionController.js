import Organization from "../models/Organization.js";
import { subirArchivoFilebase } from "../services/filebaseService.js";

/**
 * GET /api/configuracion
 * Obtener configuración de la organización del usuario autenticado
 */
export const obtenerConfiguracion = async (req, res) => {
    try {
        const organizacion = await Organization.findById(req.user.organizacion);

        if (!organizacion) {
            return res.status(404).json({ message: "Organización no encontrada." });
        }

        res.status(200).json({
            nombre: organizacion.nombre,
            industria: organizacion.industria,
            logo: organizacion.logo || null,
            tema: organizacion.tema || "claro",
        });
    } catch (error) {
        console.error("Error al obtener configuración:", error);
        res.status(500).json({ message: "Error al obtener datos de configuración." });
    }
};

/**
 * PUT /api/configuracion
 * Actualizar datos de la organización
 */
export const actualizarConfiguracion = async (req, res) => {
    try {
        const { nombre, industria, tema } = req.body;
        const organizacion = await Organization.findById(req.user.organizacion);

        if (!organizacion) {
            return res.status(404).json({ message: "Organización no encontrada." });
        }

        if (req.user.rol !== "Fundador") {
            return res.status(403).json({ message: "Solo el Fundador puede actualizar la configuración." });
        }

        // Subir logo a Filebase (si se envía)
        if (req.file) {
            const filebaseFile = await subirArchivoFilebase(req.file);
            organizacion.logo = filebaseFile.url;
        }

        if (nombre) organizacion.nombre = nombre;
        if (industria) organizacion.industria = industria;
        if (tema) organizacion.tema = tema;

        await organizacion.save();

        res.status(200).json({
            message: "Configuración actualizada exitosamente.",
            organizacion: {
                nombre: organizacion.nombre,
                industria: organizacion.industria,
                tema: organizacion.tema,
                logo: organizacion.logo || null,
            },
        });
    } catch (error) {
        console.error("Error al actualizar configuración:", error);
        res.status(500).json({ message: "Error al actualizar configuración." });
    }
};
