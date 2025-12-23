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
            required: false,
            default: null,
        },

        // 🆕 NUEVO: Marca cuándo se recalculó este resumen
        ultimaActualizacion: {
            type: Date,
            default: Date.now,
        }
    },
    {
        timestamps: true,
        versionKey: false,
        strict: true, // 🛡️ evita que entren campos maliciosos por Postman
    }
);

// Evitar duplicados por día + organización
resumenCajaSchema.index({ fecha: 1, organizacion: 1 }, { unique: true });

export default mongoose.model("ResumenCaja", resumenCajaSchema);
