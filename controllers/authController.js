import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Organization from "../models/Organization.js";

/* =====================================================
   🧩 1️⃣ Registrar Fundador y crear Organización
   - Solo se permite si NO existe un Fundador
   - Protegido contra Postman: nadie puede crear otro
===================================================== */
export const registerFundador = async (req, res) => {
  try {
    const { nombre, email, password, industria, nombreOrganizacion } = req.body;

    // Validación
    if (!nombre || !email || !password || !industria || !nombreOrganizacion) {
      return res.status(400).json({ message: "Todos los campos son obligatorios." });
    }

    // 🔒 Solo permitir si no existe Fundador
    const fundadorExiste = await User.findOne({ rol: "Fundador" });
    if (fundadorExiste) {
      return res.status(403).json({
        message: "Ya existe un Fundador registrado. Registro bloqueado."
      });
    }

    // No permitir duplicar email
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "Este email ya está en uso." });
    }

    // Encriptar contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Crear organización base
    const organizacion = await Organization.create({
      nombre: nombreOrganizacion,
      industria,
    });

    // Crear fundador
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
      },
    });
  } catch (error) {
    console.error("Error en registerFundador:", error);
    res.status(500).json({ message: "Error al registrar Fundador." });
  }
};


/* =====================================================
   🔐 2️⃣ Login de usuario
   - Protección para bloqueos y roles
===================================================== */
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email y contraseña son obligatorios." });
    }

    const user = await User.findOne({ email, activo: true });

    if (!user) {
      return res.status(400).json({ message: "Credenciales inválidas." });
    }

    const passMatch = await bcrypt.compare(password, user.password);
    if (!passMatch) {
      return res.status(400).json({ message: "Credenciales inválidas." });
    }

    const token = jwt.sign(
      {
        id: user._id,
        rol: user.rol,
        email: user.email,
        organizacion: user.organizacion,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      message: "Inicio de sesión exitoso.",
      token,
      user: {
        id: user._id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
      },
    });
  } catch (error) {
    console.error("Error en loginUser:", error);
    return res.status(500).json({ message: "Error del servidor." });
  }
};


/* =====================================================
   🔑 3️⃣ Cambiar contraseña
   - Cualquier usuario autenticado puede hacerlo
===================================================== */
export const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        message: "La nueva contraseña debe tener al menos 8 caracteres.",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await User.findByIdAndUpdate(userId, {
      password: hashedPassword,
      debeCambiarPassword: false,
    });

    return res.status(200).json({ message: "Contraseña actualizada exitosamente." });
  } catch (error) {
    console.error("Error en changePassword:", error);
    return res.status(500).json({ message: "Error del servidor." });
  }
};


/* =====================================================
   👤 4️⃣ Obtener perfil del usuario autenticado
   - Protección contra acceso cruzado entre organizaciones
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

    // 🔒 Protección: un usuario jamás puede ver otro perfil
    if (user._id.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: "Acceso no autorizado." });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error("Error en getProfile:", error);
    return res.status(500).json({ message: "Error del servidor." });
  }
};
