import mongoose from "mongoose";

const resumenCajaSchema = new mongoose.Schema(
    {
        businessDate: {
            type: String,
            required: true,
        },
        timezone: {
            type: String,
            default: "America/Bogota",
        },

        fecha: {
            type: Date,
            required: true,
        },

        saldoInicial: Number,
        ingresosTotales: Number,
        egresosTotales: Number,
        saldoFinal: Number,

        creadoPor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        organizacion: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },
    },
    { timestamps: true }
);

resumenCajaSchema.index(
    { organizacion: 1, businessDate: 1 },
    { unique: true }
);

export default mongoose.model("ResumenCaja", resumenCajaSchema);
