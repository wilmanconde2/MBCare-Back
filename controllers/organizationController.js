import bcrypt from "bcryptjs";
import User from "../models/User.js";

/**
 * Crear usuario Profesional o Asistente
 * Solo Fundador puede crear usuarios
 */
export const crearUsuarioPorRol = async (req, res) => {
    try {
        if (req.user.rol !== "Fundador") {
            return res
                .status(403)
                .json({ message: "No tienes permisos para crear usuarios." });
        }

        const { nombre, email, rol } = req.body;

        if (!nombre || !email || !rol) {
            return res
                .status(400)
                .json({ message: "Todos los campos son obligatorios." });
        }

        if (!["Profesional", "Asistente"].includes(rol)) {
            return res.status(400).json({ message: "Rol inválido." });
        }

        const existe = await User.findOne({ email });
        if (existe) {
            return res
                .status(400)
                .json({ message: "Este correo ya está registrado." });
        }

        const tempPassword = Math.random().toString(36).slice(-10);

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(tempPassword, salt);

        const nuevoUsuario = await User.create({
            nombre,
            email,
            rol,
            organizacion: req.user.organizacion,
            password: hashedPassword,
            debeCambiarPassword: true,
            activo: true,
        });

        return res.status(201).json({
            message: "Usuario creado exitosamente.",
            usuario: {
                id: nuevoUsuario._id,
                nombre: nuevoUsuario.nombre,
                email: nuevoUsuario.email,
                rol: nuevoUsuario.rol,
                organizacion: nuevoUsuario.organizacion,
                temporalPassword: tempPassword, // eliminar en producción
                // TODO ELIMINAR ESTE CAMPO DESPUÉS DE LAS PRUEBAS
            },
        });
    } catch (error) {
        console.error("Error en crearUsuarioPorRol:", error);
        return res.status(500).json({ message: "Error del servidor." });
    }
};
