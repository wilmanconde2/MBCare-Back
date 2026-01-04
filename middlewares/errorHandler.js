// mbcare-backend/middlewares/errorHandler.js

export const errorHandler = (err, req, res, next) => {
    console.error("Error:", err);

    // Error de Mongoose: ID inválido
    if (err.name === "CastError") {
        return res.status(400).json({
            message: "ID inválido.",
        });
    }

    // Error de validación de Mongoose
    if (err.name === "ValidationError") {
        return res.status(400).json({
            message: "Datos inválidos.",
            detalles: Object.values(err.errors).map(e => e.message),
        });
    }

    // Token inválido
    if (err.name === "JsonWebTokenError") {
        return res.status(401).json({
            message: "Token inválido.",
        });
    }

    // Token expirado
    if (err.name === "TokenExpiredError") {
        return res.status(401).json({
            message: "Token expirado.",
        });
    }

    return res.status(err.statusCode || 500).json({
        message: err.message || "Error interno del servidor.",
    });
};
