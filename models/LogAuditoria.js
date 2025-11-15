import mongoose from "mongoose";

const logSchema = new mongoose.Schema(
    {
        usuario: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Usuario",
            required: true,
        },
        organizacion: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organizacion",
            required: true,
        },
        accion: {
            type: String,
            required: true,
        },
        detalle: {
            type: Object,
            default: {},
        },
        ruta: {
            type: String,
        },
        metodo: {
            type: String,
        },
        ip: {
            type: String,
        }
    },
    { timestamps: true }
);

export default mongoose.model("LogAuditoria", logSchema);
