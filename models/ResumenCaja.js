import mongoose from "mongoose";

const resumenCajaSchema = new mongoose.Schema(
    {
        fecha: {
            type: Date,
            required: true,
        },
        organizacion: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },
        ingresosTotales: {
            type: Number,
            required: true,
            default: 0,
        },
        egresosTotales: {
            type: Number,
            required: true,
            default: 0,
        },
        saldoInicial: {
            type: Number,
            required: true,
        },
        saldoFinal: {
            type: Number,
            required: true,
        },
        creadoPor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

// Para evitar duplicados
resumenCajaSchema.index({ fecha: 1, organizacion: 1 }, { unique: true });

export default mongoose.model("ResumenCaja", resumenCajaSchema);
