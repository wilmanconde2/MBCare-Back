// /mbcare-backend/controllers/userController.js

import User from "../models/User.js";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

/* ============================================================================
   🟢 Crear usuario secundario (solo Fundador)
   Roles permitidos de creación: Profesional / Asistente
============================================================================ */
export const crearUsuarioSecundario = async (req, res) => {
    try {
        const { nombre, email, password, rol } = req.body;

        // 🔒 Seguridad: bloquear por rol (solo Fundador)
        if (req.user.rol !== "Fundador") {
            return res.status(403).json({ message: "Solo el Fundador puede crear usuarios." });
        }

        if (!["Profesional", "Asistente"].includes(rol)) {
            return res.status(400).json({ message: "Rol inválido. Solo Profesional o Asistente." });
        }

        if (!nombre || !email || !password) {
            return res.status(400).json({ message: "Todos los campos son obligatorios." });
        }

        const fundador = await User.findById(req.user._id).populate("organizacion");
        if (!fundador) {
            return res.status(404).json({ message: "Fundador no encontrado." });
        }

        const existe = await User.findOne({ email });
        if (existe) {
            return res.status(400).json({ message: "Este correo ya está en uso." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const nuevoUsuario = await User.create({
            nombre,
            email,
            password: hashedPassword,
            rol,
            organizacion: fundador.organizacion._id,
            creadoPor: req.user._id,
            activo: true,
            debeCambiarPassword: true,
        });

        return res.status(201).json({
            message: "Usuario creado correctamente.",
            usuario: {
                id: nuevoUsuario._id,
                nombre: nuevoUsuario.nombre,
                email: nuevoUsuario.email,
                rol: nuevoUsuario.rol,
            },
        });
    } catch (error) {
        console.error("Error al crear usuario:", error);
        return res.status(500).json({
            message: "Error al crear usuario.",
            error: error.message,
        });
    }
};

/* ============================================================================
   🔄 Activar / Desactivar usuario
   Solo Fundador puede activar o desactivar
============================================================================ */
export const toggleUsuarioActivo = async (req, res) => {
    try {
        const { id } = req.params;

        // 🔒 Seguridad: solo Fundador
        if (req.user.rol !== "Fundador") {
            return res.status(403).json({
                message: "Solo el Fundador puede activar o desactivar usuarios.",
            });
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "ID de usuario inválido." });
        }

        const usuario = await User.findById(id);
        if (!usuario) {
            return res.status(404).json({ message: "Usuario no encontrado." });
        }

        // 🚫 No se puede desactivar al Fundador
        if (usuario.rol === "Fundador") {
            return res.status(403).json({ message: "No se puede desactivar al Fundador." });
        }

        usuario.activo = !usuario.activo;
        await usuario.save();

        return res.status(200).json({
            message: `Usuario ${usuario.activo ? "activado" : "desactivado"} correctamente.`,
            usuario,
        });
    } catch (error) {
        console.error("Error al actualizar usuario:", error);
        return res.status(500).json({
            message: "Error al actualizar usuario.",
            error: error.message,
        });
    }
};

/* ============================================================================
   🛡️ Cambiar rol de usuario
   Solo Fundador
   - No se puede cambiar el rol del Fundador
   - Roles destino: Profesional | Asistente
============================================================================ */
export const cambiarRolUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        const { rol } = req.body;

        // Solo Fundador
        if (req.user.rol !== "Fundador") {
            return res.status(403).json({ message: "No tienes permisos para cambiar roles." });
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "ID de usuario inválido." });
        }

        const rolesPermitidos = ["Profesional", "Asistente"];
        if (!rolesPermitidos.includes(rol)) {
            return res.status(400).json({ message: "Rol inválido." });
        }

        const usuario = await User.findById(id);
        if (!usuario) {
            return res.status(404).json({ message: "Usuario no encontrado." });
        }

        // Misma organización
        if (String(usuario.organizacion) !== String(req.user.organizacion)) {
            return res.status(403).json({ message: "No puedes modificar usuarios de otra organización." });
        }

        // No tocar al Fundador
        if (usuario.rol === "Fundador") {
            return res.status(403).json({ message: "No se puede modificar el rol del Fundador." });
        }

        usuario.rol = rol;
        await usuario.save();

        return res.status(200).json({
            message: "Rol actualizado correctamente.",
            usuario: {
                id: usuario._id,
                nombre: usuario.nombre,
                email: usuario.email,
                rol: usuario.rol,
                activo: usuario.activo,
            },
        });
    } catch (error) {
        console.error("Error al cambiar rol:", error);
        return res.status(500).json({
            message: "Error al cambiar rol.",
            error: error.message,
        });
    }
};

/* ============================================================================
   📋 Listar usuarios de la organización
   Fundador → ve todos
   Profesional/Asistente → solo activos
============================================================================ */
export const listarUsuarios = async (req, res) => {
    try {
        const { rol: rolSolicitante, organizacion } = req.user;
        const { rol } = req.query;

        const filtro = { organizacion };

        // 🔹 No Fundador → solo usuarios activos
        if (rolSolicitante !== "Fundador") {
            filtro.activo = true;
        }

        // Filtro opcional por rol
        if (rol) {
            filtro.rol = rol;
        }

        const usuarios = await User.find(filtro).select("-password");

        return res.status(200).json({ usuarios });
    } catch (error) {
        console.error("Error al listar usuarios:", error);
        return res.status(500).json({
            message: "Error al obtener usuarios.",
            error: error.message,
        });
    }
};
