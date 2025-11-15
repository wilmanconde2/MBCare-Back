import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer")
    ) {
        try {
            token = req.headers.authorization.split(" ")[1];

            // Verificar firma del token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Obtener usuario sin password
            const user = await User.findById(decoded.id).select("-password");

            if (!user) {
                return res.status(401).json({ message: "Usuario no válido." });
            }

            // ❗ Bloqueado si se encuentra inactivo
            if (!user.activo) {
                return res.status(403).json({
                    message: "Usuario desactivado. No tiene acceso.",
                });
            }

            // ❗ Bloqueado si no pertenece a organización válida
            if (!user.organizacion) {
                return res.status(403).json({
                    message: "Organización no válida.",
                });
            }

            req.user = user;
            next();

        } catch (error) {
            console.error("Error en protect middleware:", error);
            return res.status(401).json({
                message: "Token inválido o expirado.",
            });
        }
    } else {
        return res.status(401).json({
            message: "No autorizado. Token no enviado.",
        });
    }
};
