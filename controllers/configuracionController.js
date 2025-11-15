import Organization from "../models/Organization.js";
import { subirArchivoFilebase } from "../services/filebaseService.js";

/**
 * GET /api/configuracion
 * Solo Fundador o Asistente pueden ver la configuración
 * Profesional no accede
 */
export const obtenerConfiguracion = async (req, res) => {
    try {
        if (req.user.rol === "Profesional") {
            return res.status(403).json({ message: "No tienes permisos para ver configuración." });
        }

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
 * Solo Fundador puede editar configuración
 * Asistente y Profesional bloqueados incluso desde Postman
 */
export const actualizarConfiguracion = async (req, res) => {
    try {
        if (req.user.rol !== "Fundador") {
            return res.status(403).json({ message: "No tienes permisos para actualizar configuración." });
        }

        const { nombre, industria, tema } = req.body;
        const organizacion = await Organization.findById(req.user.organizacion);

        if (!organizacion) {
            return res.status(404).json({ message: "Organización no encontrada." });
        }

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
