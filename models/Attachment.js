import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
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
        url: {
            type: String,
            required: true,
        },
        public_id: {
            type: String,
            required: true,
        },
        descripcion: {
            type: String,
        },
        tipo: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

const Attachment = mongoose.model("Attachment", attachmentSchema);
export default Attachment;
