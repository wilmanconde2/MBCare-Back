import mongoose from "mongoose";

const cashRegisterSchema = new mongoose.Schema(
    {
        businessDate: {
            type: String, // YYYY-MM-DD
            required: true,
        },
        timezone: {
            type: String,
            default: "America/Bogota",
        },

        // Mantienes fecha como Date (inicio del día Bogotá en UTC)
        fecha: {
            type: Date,
            required: true,
        },

        saldoInicial: {
            type: Number,
            default: 0,
        },
        saldoFinal: {
            type: Number,
            default: 0,
        },
        abierta: {
            type: Boolean,
            default: true,
        },
        profesional: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        organizacion: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },
    },
    { timestamps: true }
);

// 🔒 UNA SOLA CAJA POR DÍA Y ORGANIZACIÓN
cashRegisterSchema.index(
    { organizacion: 1, businessDate: 1 },
    { unique: true }
);

export default mongoose.model("CashRegister", cashRegisterSchema);
