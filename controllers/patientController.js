// mbcare-backend/controllers/patientController.js

import Patient from "../models/Patient.js";

const PICK_FIELDS = [
    "nombreCompleto",
    "tipoDocumento",
    "numeroDocumento",
    "fechaNacimiento",
    "genero",
    "telefono",
    "email",
    "direccion",
    "ocupacion",
    "estadoCivil",
    "pesoKg",
    "alturaCm",
    "alergias",
    "lesiones",
    "operaciones",
    "razonVisita",
    "valoracion",
    "observaciones",
];

function pick(body) {
    const out = {};
    for (const key of PICK_FIELDS) {
        if (body[key] !== undefined) out[key] = body[key];
    }
    return out;
}

function normalizePatientInput(body) {
    const out = pick(body);

    // Normalizar números (acepta "98", "98.5", "" -> undefined)
    for (const k of ["pesoKg", "alturaCm"]) {
        if (out[k] === "" || out[k] === null) {
            delete out[k];
            continue;
        }
        if (out[k] !== undefined) {
            const n = Number(out[k]);
            if (Number.isNaN(n)) delete out[k];
            else out[k] = n;
        }
    }

    // Normalizar strings vacíos a undefined (evita guardar "")
    for (const k of ["alergias", "lesiones", "operaciones", "razonVisita", "valoracion", "ocupacion", "observaciones", "direccion", "ciudad", "pais", "telefono", "email"]) {
        if (out[k] === "") delete out[k];
    }

    return out;
}

/**
 * 🔸 Crear nuevo paciente
 * Fundador / Profesional / Asistente → permitido
 */
export const crearPaciente = async (req, res) => {
    try {
        const { nombreCompleto, numeroDocumento } = req.body;

        if (!nombreCompleto) {
            return res.status(400).json({ message: "El nombre es obligatorio" });
        }

        // Evitar duplicados por documento
        if (numeroDocumento) {
            const existe = await Patient.findOne({
                numeroDocumento,
                organizacion: req.user.organizacion,
            });

            if (existe) {
                return res.status(400).json({ message: "Este documento ya está registrado" });
            }
        }
        const nuevoPaciente = new Patient({
            ...normalizePatientInput(req.body),
            creadoPor: req.user.id,
            organizacion: req.user.organizacion,
        });



        await nuevoPaciente.save();

        res.status(201).json({ message: "Paciente creado correctamente", paciente: nuevoPaciente });
    } catch (error) {
        console.error("Error al crear paciente:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

/**
 * 🔸 Listar pacientes por organización
 * Fundador / Profesional / Asistente → permitido
 */
export const listarPacientes = async (req, res) => {
    try {
        const pacientes = await Patient.find({
            organizacion: req.user.organizacion,
        }).sort({ createdAt: -1 });

        res.status(200).json(pacientes);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener pacientes" });
    }
};

/**
 * 🔸 Obtener un solo paciente
 * Fundador / Profesional / Asistente → permitido
 */
export const obtenerPacientePorId = async (req, res) => {
    try {
        const paciente = await Patient.findOne({
            _id: req.params.id,
            organizacion: req.user.organizacion,
        });

        if (!paciente) {
            return res.status(404).json({ message: "Paciente no encontrado" });
        }

        res.json(paciente);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener el paciente" });
    }
};

/**
 * 🔸 Actualizar paciente
 * Fundador / Profesional / Asistente → permitido
 */
export const actualizarPaciente = async (req, res) => {
    try {
        const paciente = await Patient.findOneAndUpdate(
            { _id: req.params.id, organizacion: req.user.organizacion },
            normalizePatientInput(req.body),
            { new: true, runValidators: true }
        );

        if (!paciente) {
            return res.status(404).json({ message: "Paciente no encontrado" });
        }

        res.json({ message: "Paciente actualizado", paciente });
    } catch (error) {
        res.status(500).json({ message: "Error al actualizar paciente" });
    }
};

/**
 * 🔸 Eliminar paciente
 * SOLO Fundador puede eliminar (validado en ruta + validación extra aquí)
 */
export const eliminarPaciente = async (req, res) => {
    try {
        // Validación extra de seguridad
        if (req.user.rol !== "Fundador") {
            return res.status(403).json({ message: "No tienes permisos para eliminar pacientes." });
        }

        const paciente = await Patient.findOneAndDelete({
            _id: req.params.id,
            organizacion: req.user.organizacion,
        });

        if (!paciente) {
            return res.status(404).json({ message: "Paciente no encontrado" });
        }

        res.json({ message: "Paciente eliminado" });
    } catch (error) {
        res.status(500).json({ message: "Error al eliminar paciente" });
    }
};
