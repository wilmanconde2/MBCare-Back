import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
    {
        tipo: {
            type: String,
            enum: ["Ingreso", "Egreso"],
            required: true,
        },

        // Categoría general (Consulta general, Servicios, Salarios, etc.)
        categoria: {
            type: String,
            trim: true,
        },

        descripcion: {
            type: String,
            required: true,
            trim: true,
        },

        monto: {
            type: Number,
            required: true,
        },

        metodoPago: {
            type: String,
            enum: ["Efectivo", "Transferencia", "Tarjeta", "Otro"],
            default: "Efectivo",
        },

        // Paciente opcional asociado al movimiento (solo aplica a ciertos Ingresos)
        paciente: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Patient",
        },

        caja: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CashRegister",
            required: true,
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
    {
        timestamps: true,
        versionKey: false,
    }
);

export default mongoose.model("Transaction", transactionSchema);
