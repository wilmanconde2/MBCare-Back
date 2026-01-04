// mbcare-backend/models/Patient.js

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
                "Separado",
                "Divorciado",
                "Viudo",
                "Otro",
            ],
        },
        
        // Salud / Historia clínica básica
        pesoKg: {
            type: Number,
            min: [0, "El peso no puede ser negativo."],
            max: [250, "El peso es demasiado alto."],
        },

        alturaCm: {
            type: Number,
            min: [0, "La altura no puede ser negativa."],
            max: [250, "La altura es demasiado alta."],
        },

        alergias: {
            type: String,
            trim: true,
            maxlength: 1000,
        },

        lesiones: {
            type: String,
            trim: true,
            maxlength: 1000,
        },

        operaciones: {
            type: String,
            trim: true,
            maxlength: 1000,
        },

        razonVisita: {
            type: String,
            trim: true,
            maxlength: 1000,
        },

        valoracion: {
            type: String,
            trim: true,
            maxlength: 2000,
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
