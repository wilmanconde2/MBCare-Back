import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
    {
        tipo: {
            type: String,
            enum: ["Ingreso", "Egreso"],
            required: true,
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
