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

        // 🆕 Marca cuándo se actualizó por última vez (para recalcular)
        ultimaActualizacion: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
        versionKey: false,
        strict: true,
    }
);

// Un solo consolidado por mes + año + organización
consolidadoMensualSchema.index(
    { mes: 1, anio: 1, organizacion: 1 },
    { unique: true }
);

export default mongoose.model("ConsolidadoMensual", consolidadoMensualSchema);
