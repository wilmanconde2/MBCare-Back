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

        fechaSesion: {
            type: Date,
            required: true,
            default: Date.now,
        },

        observaciones: {
            type: String,
            trim: true,
            default: "",
        },

        diagnostico: {
            type: String,
            trim: true,
            default: "",
        },

        planTratamiento: {
            type: String,
            trim: true,
            default: "",
        },

        titulo: { type: String, trim: true, default: "" },

        contenido: {
            type: String,
            trim: true,
            default: "", 
        },

        tipoNota: { type: String, trim: true, default: "" },

        adjuntos: [{ type: String, trim: true }],
    },
    { timestamps: true }
);

/**
 * ✅ Virtual: contenidoClinico
 * Para que cualquier nota (nueva o vieja) siempre tenga "texto" mostrable.
 */
noteSchema.virtual("contenidoClinico").get(function () {
    const hasNewFields =
        (this.observaciones && this.observaciones.trim()) ||
        (this.diagnostico && this.diagnostico.trim()) ||
        (this.planTratamiento && this.planTratamiento.trim());

    if (hasNewFields) {
        const parts = [];
        if (this.observaciones?.trim()) parts.push(`Observaciones:\n${this.observaciones.trim()}`);
        if (this.diagnostico?.trim()) parts.push(`Diagnóstico:\n${this.diagnostico.trim()}`);
        if (this.planTratamiento?.trim()) parts.push(`Plan de tratamiento:\n${this.planTratamiento.trim()}`);
        return parts.join("\n\n");
    }

    return this.contenido || "";
});

noteSchema.set("toJSON", { virtuals: true });
noteSchema.set("toObject", { virtuals: true });

export default mongoose.model("Note", noteSchema);
