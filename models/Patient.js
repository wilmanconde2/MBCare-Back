import mongoose from "mongoose";

const patientSchema = new mongoose.Schema(
    {
        // Identificación
        nombreCompleto: {
            type: String,
            required: [true, "El nombre del paciente es obligatorio."],
            trim: true,
        },

        tipoDocumento: {
            type: String,
            enum: ["CC", "TI", "CE", "Pasaporte", "Otro"],
            default: "CC",
        },

        numeroDocumento: {
            type: String,
            required: [true, "El número de documento es obligatorio."],
            trim: true,
        },

        fechaNacimiento: {
            type: Date,
        },

        genero: {
            type: String,
            enum: ["Masculino", "Femenino", "Otro"],
        },

        // Contacto
        telefono: {
            type: String,
            trim: true,
        },

        email: {
            type: String,
            trim: true,
            lowercase: true,
        },

        direccion: {
            type: String,
            trim: true,
        },

        ciudad: {
            type: String,
            trim: true,
        },

        pais: {
            type: String,
            trim: true,
            default: "Colombia",
        },

        // Información adicional
        ocupacion: {
            type: String,
            trim: true,
        },

        estadoCivil: {
            type: String,
            enum: [
                "Soltero",
                "Casado",
                "Unión libre",
                "Divorciado",
                "Viudo",
                "Otro",
            ],
        },

        observaciones: {
            type: String,
            trim: true,
            maxlength: 1000,
        },

        // Organización y usuario
        creadoPor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        organizacion: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },

        // Estado del paciente
        activo: {
            type: Boolean,
            default: true,
        },

        fechaRegistro: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

export default mongoose.model("Patient", patientSchema);
