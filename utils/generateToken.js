// mbcare-backend/utils/generateToken.js

import jwt from "jsonwebtoken";

/**
 * Genera un JWT con los datos del usuario
 * @param {Object} payload - Datos a incluir en el token (id, rol, email)
 * @returns {String} token JWT firmado
 */
const generateToken = (payload) => {
    const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "7h";

    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: jwtExpiresIn,
    });
};

export default generateToken;
