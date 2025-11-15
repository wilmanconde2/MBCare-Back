import LogAuditoria from "../models/LogAuditoria.js";

export const auditar = async (req, accion, detalle = {}) => {
    try {
        await LogAuditoria.create({
            usuario: req.user?._id,
            organizacion: req.user?.organizacion,
            accion,
            detalle,
            ruta: req.originalUrl,
            metodo: req.method,
            ip: req.ip,
        });
    } catch (error) {
        console.error("Error al registrar auditoría:", error);
    }
};
