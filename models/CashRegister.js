import mongoose from "mongoose";

const cashRegisterSchema = new mongoose.Schema(
    {
        fecha: {
            type: Date,
            required: true,
        },
        saldoInicial: {
            type: Number,
            required: true,
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
    {
        timestamps: true,
        versionKey: false,
    }
);

cashRegisterSchema.index({ fecha: 1, organizacion: 1 }, { unique: true });

export default mongoose.model("CashRegister", cashRegisterSchema);
