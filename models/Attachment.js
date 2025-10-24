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
            type: String, // ID de Cloudinary para poder eliminarlo luego
            required: true,
        },
        descripcion: {
            type: String,
            trim: true,
        },
        tipo: {
            type: String, // image / pdf / audio / etc
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

const Attachment = mongoose.model("Attachment", attachmentSchema);
export default Attachment;
