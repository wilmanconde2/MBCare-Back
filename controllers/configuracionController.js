// mbcare-backend/controllers/configuracionController.js

import Organization from "../models/Organization.js";

/**
 * GET /api/configuracion
 * Fundador / Profesional / Asistente pueden VER:
 * - nombre de la organización
 * - industria
 */
export const obtenerConfiguracion = async (req, res) => {
    try {
        const organizacion = await Organization.findById(req.user.organizacion).select(
            "nombre industria"
        );

        if (!organizacion) {
            return res.status(404).json({ message: "Organización no encontrada." });
        }

        return res.status(200).json({
            organizacion: {
                id: organizacion._id,
                nombre: organizacion.nombre,
                industria: organizacion.industria,
            },
        });
    } catch (error) {
        console.error("Error en obtenerConfiguracion:", error);
        return res
            .status(500)
            .json({ message: "Error al obtener datos de configuración." });
    }
};

/**
 * PATCH /api/configuracion/organizacion/nombre
 * Solo Fundador puede EDITAR:
 * - nombre de la organización
 * Industria SOLO lectura (nadie la cambia aquí)
 */
export const actualizarNombreOrganizacion = async (req, res) => {
    try {
        if (req.user.rol !== "Fundador") {
            return res
                .status(403)
                .json({ message: "No tienes permisos para actualizar la organización." });
        }

        const { nombreOrganizacion } = req.body;

        if (!nombreOrganizacion || !nombreOrganizacion.trim()) {
            return res
                .status(400)
                .json({ message: "El nombre de la organización es obligatorio." });
        }

        const organizacion = await Organization.findById(req.user.organizacion);

        if (!organizacion) {
            return res.status(404).json({ message: "Organización no encontrada." });
        }

        organizacion.nombre = nombreOrganizacion.trim();
        await organizacion.save();

        return res.status(200).json({
            message: "Nombre de organización actualizado exitosamente.",
            organizacion: {
                id: organizacion._id,
                nombre: organizacion.nombre,
                industria: organizacion.industria,
            },
        });
    } catch (error) {
        console.error("Error en actualizarNombreOrganizacion:", error);
        return res
            .status(500)
            .json({ message: "Error al actualizar el nombre de la organización." });
    }
};
