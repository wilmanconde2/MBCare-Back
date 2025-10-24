import jwt from "jsonwebtoken";

/**
 * Genera un JWT con los datos del usuario
 * @param {Object} payload - Datos a incluir en el token (id, rol, email)
 * @returns {String} token JWT firmado
 */
const generateToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: "7d",
    });
};

export default generateToken;
