import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
    {
        paciente: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Patient",
            required: true,
        },

        profesional: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        fecha: {
            type: Date,
            required: true,
        },

        duracion: {
            type: Number, // minutos
            default: 60,
        },

        tipo: {
            type: String,
            enum: ["Presencial", "Virtual"],
            default: "Presencial",
        },

        estado: {
            type: String,
            enum: ["Programada", "Cancelada", "Completada"],
            default: "Programada",
        },

        notas: {
            type: String,
            trim: true,
        },

        organizacion: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },
    },
    { timestamps: true }
);

export default mongoose.model("Appointment", appointmentSchema);
