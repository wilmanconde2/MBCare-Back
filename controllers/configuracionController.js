// mbcare-backend/controllers/configuracionController.js

import Organization from "../models/Organization.js";

/**
 * GET /api/configuracion
 * Solo Fundador o Asistente
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
            tema: organizacion.tema || "claro"
            // logo eliminado
        });
    } catch (error) {
        res.status(500).json({ message: "Error al obtener datos de configuración." });
    }
};

/**
 * PUT /api/configuracion
 * Solo Fundador
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

        if (nombre) organizacion.nombre = nombre;
        if (industria) organizacion.industria = industria;
        if (tema) organizacion.tema = tema;

        await organizacion.save();

        res.status(200).json({
            message: "Configuración actualizada exitosamente.",
            organizacion: {
                nombre: organizacion.nombre,
                industria: organizacion.industria,
                tema: organizacion.tema
            }
        });
    } catch (error) {
        res.status(500).json({ message: "Error al actualizar configuración." });
    }
};
