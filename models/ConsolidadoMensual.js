import mongoose from "mongoose";

const consolidadoMensualSchema = new mongoose.Schema(
    {
        mes: {
            type: Number, // 1 = Enero, 12 = Diciembre
            required: true,
            min: 1,
            max: 12,
        },
        anio: {
            type: Number, // Año (ej. 2025)
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
            default: 0,
        },
        saldoFinal: {
            type: Number,
            required: true,
            default: 0,
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

// Asegura que solo haya un consolidado por mes, año y organización
consolidadoMensualSchema.index(
    { mes: 1, anio: 1, organizacion: 1 },
    { unique: true }
);

export default mongoose.model("ConsolidadoMensual", consolidadoMensualSchema);
