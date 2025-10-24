import User from "../models/User.js";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

// 🟢 Crear usuario secundario (Profesional o Asistente)
export const crearUsuarioSecundario = async (req, res) => {
    try {
        const { nombre, email, password, rol } = req.body;
        const creadorId = req.user._id;
        const rolCreador = req.user.rol;

        if (rolCreador !== "Fundador") {
            return res.status(403).json({ message: "Solo el Fundador puede crear usuarios." });
        }

        const fundador = await User.findById(creadorId).populate("organizacion");

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
            creadoPor: creadorId,
        });

        res.status(201).json({
            message: "Usuario creado correctamente.",
            usuario: {
                id: nuevoUsuario._id,
                nombre: nuevoUsuario.nombre,
                email: nuevoUsuario.email,
                rol: nuevoUsuario.rol,
            },
        });
    } catch (error) {
        res.status(500).json({ message: "Error al crear usuario.", error: error.message });
    }
};

// 🔄 Activar/Desactivar usuario

export const toggleUsuarioActivo = async (req, res) => {
    try {
        const { id } = req.params;

        // ✅ Verificar que el ID tenga formato válido
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

        res.status(200).json({
            message: `Usuario ${usuario.activo ? "activado" : "desactivado"} correctamente.`,
            usuario,
        });
    } catch (error) {
        console.error("Error al actualizar usuario:", error);
        res.status(500).json({ message: "Error al actualizar usuario.", error: error.message });
    }
};

// 📋 Listar usuarios de la misma organización
export const listarUsuarios = async (req, res) => {
    try {
        const { rol: rolSolicitante, organizacion } = req.user;
        const { rol } = req.query; // Ej: /api/usuarios?rol=Profesional

        const filtroBase = { organizacion };

        // Si no es Fundador, solo mostrar usuarios activos
        if (rolSolicitante !== "Fundador") {
            filtroBase.activo = true;
        }

        // Si viene el filtro opcional de rol
        if (rol) {
            filtroBase.rol = rol;
        }

        const usuarios = await User.find(filtroBase).select("-password");

        return res.status(200).json({ usuarios });
    } catch (error) {
        console.error("Error al listar usuarios:", error);
        return res.status(500).json({
            message: "Error al obtener usuarios.",
            error: error.message,
        });
    }
};

