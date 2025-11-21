import mongoose from "mongoose";

const noteSchema = new mongoose.Schema(
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

        organizacion: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },

        titulo: {
            type: String,
            trim: true,
        },

        contenido: {
            type: String,
            required: true,
            trim: true,
        },

        tipoNota: {
            type: String,
            trim: true,
        },

        adjuntos: [
            {
                type: String, // URL de archivo
                trim: true,
            },
        ],
    },
    { timestamps: true }
);

export default mongoose.model("Note", noteSchema);
