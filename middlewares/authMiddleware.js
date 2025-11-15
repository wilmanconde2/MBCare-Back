import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
    try {
        let token;

        // 1️⃣ Primero intentar leer token desde COOKIE (Frontend React)
        if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
        }

        // 2️⃣ Si no existe cookie, intentar Authorization Bearer (Postman)
        else if (
            req.headers.authorization &&
            req.headers.authorization.startsWith("Bearer")
        ) {
            token = req.headers.authorization.split(" ")[1];
        }

        // 3️⃣ Si no se encontró token en ningún lugar
        if (!token) {
            return res.status(401).json({
                message: "No autorizado. Token no enviado.",
            });
        }

        // 4️⃣ Verificar token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 5️⃣ Buscar usuario
        const user = await User.findById(decoded.id).select("-password");

        if (!user) {
            return res.status(401).json({ message: "Usuario no válido." });
        }

        if (!user.activo) {
            return res.status(403).json({
                message: "Usuario desactivado. No tiene acceso.",
            });
        }

        if (!user.organizacion) {
            return res.status(403).json({
                message: "Organización no válida.",
            });
        }

        // 6️⃣ Adjuntar usuario a la request
        req.user = {
            id: user._id,
            nombre: user.nombre,
            email: user.email,
            rol: user.rol,
            organizacion: user.organizacion,
        };

        next();
    } catch (error) {
        console.error("Error en protect middleware:", error);
        return res.status(401).json({
            message: "Token inválido o expirado.",
        });
    }
};
