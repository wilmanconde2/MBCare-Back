// mbcare-backend/controllers/authController.js

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Organization from "../models/Organization.js";

/* =====================================================
   🧩 1️⃣ Registrar Fundador y crear Organización
===================================================== */
export const registerFundador = async (req, res) => {
  try {
    const { nombre, email, password, industria, nombreOrganizacion } = req.body;

    if (!nombre || !email || !password || !industria || !nombreOrganizacion) {
      return res.status(400).json({ message: "Todos los campos son obligatorios." });
    }

    const fundadorExiste = await User.findOne({ rol: "Fundador" });
    if (fundadorExiste) {
      return res.status(403).json({
        message: "Ya existe un Fundador registrado. Registro bloqueado.",
      });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "Este email ya está en uso." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const organizacion = await Organization.create({
      nombre: nombreOrganizacion,
      industria,
    });

    const user = await User.create({
      nombre,
      email,
      password: hashedPassword,
      rol: "Fundador",
      organizacion: organizacion._id,
      activo: true,
      debeCambiarPassword: false,
    });

    organizacion.creadaPor = user._id;
    await organizacion.save();

    return res.status(201).json({
      message: "Cuenta Fundador y organización creadas correctamente.",
      user: {
        id: user._id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        organizacion: organizacion.nombre,
        debeCambiarPassword: user.debeCambiarPassword,
      },
    });
  } catch (error) {
    console.error("Error en registerFundador:", error);
    res.status(500).json({ message: "Error al registrar Fundador." });
  }
};

/* =====================================================
   🔐 2️⃣ Login de usuario
===================================================== */
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email y contraseña son obligatorios." });
    }

    let user = await User.findOne({ email, activo: true }).populate({
      path: "organizacion",
      select: "nombre industria",
    });

    if (!user) {
      return res.status(400).json({ message: "Credenciales inválidas." });
    }

    const passMatch = await bcrypt.compare(password, user.password);
    if (!passMatch) {
      return res.status(400).json({ message: "Credenciales inválidas." });
    }

    const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "7h";

    const token = jwt.sign(
      {
        id: user._id,
        rol: user.rol,
        email: user.email,
        organizacion: user.organizacion?._id,
      },
      process.env.JWT_SECRET,
      { expiresIn: jwtExpiresIn }
    );

    // Nota: en prod probablemente quieras secure=true y sameSite="none" si front y back están en dominios distintos.
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    return res.status(200).json({
      message: "Inicio de sesión exitoso.",
      user: {
        id: user._id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        debeCambiarPassword: user.debeCambiarPassword,
        organizacion: {
          id: user.organizacion?._id,
          nombre: user.organizacion?.nombre,
          industria: user.organizacion?.industria,
        },
      },
    });
  } catch (error) {
    console.error("Error en loginUser:", error);
    return res.status(500).json({ message: "Error del servidor." });
  }
};

/* =====================================================
   🔑 3️⃣ Cambiar contraseña (SEGURA)
   Requiere contraseña actual + nueva
===================================================== */
export const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Contraseña actual y nueva contraseña son obligatorias.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        message: "La nueva contraseña debe tener al menos 8 caracteres.",
      });
    }

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return res.status(400).json({
        message: "La confirmación de contraseña no coincide.",
      });
    }

    const user = await User.findById(userId).select("+password");
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado." });
    }

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return res.status(400).json({ message: "La contraseña actual es incorrecta." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    user.debeCambiarPassword = false;
    await user.save();

    return res.status(200).json({ message: "Contraseña actualizada exitosamente." });
  } catch (error) {
    console.error("Error en changePassword:", error);
    return res.status(500).json({ message: "Error del servidor." });
  }
};

/* =====================================================
   👤 4️⃣ Obtener perfil del usuario autenticado
===================================================== */
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("-password")
      .populate({
        path: "organizacion",
        select: "nombre industria creadaPor",
      });

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado." });
    }

    if (user._id.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: "Acceso no autorizado." });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error("Error en getProfile:", error);
    return res.status(500).json({ message: "Error del servidor." });
  }
};

/* =====================================================
   ✅ 5️⃣ Verificar token
===================================================== */
export const verifyTokenController = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("-password")
      .populate({
        path: "organizacion",
        select: "nombre industria",
      });

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error("Error en verifyTokenController:", error);
    return res.status(500).json({ message: "Error del servidor" });
  }
};
