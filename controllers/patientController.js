import Patient from "../models/Patient.js";

// 🔸 Crear nuevo paciente
export const crearPaciente = async (req, res) => {
    try {
        const { nombreCompleto, numeroDocumento } = req.body;

        // Validación básica
        if (!nombreCompleto) {
            return res.status(400).json({ message: "El nombre es obligatorio" });
        }

        // Evitar duplicados por documento (si aplica)
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
            ...req.body,
            creadoPor: req.user._id,
            organizacion: req.user.organizacion,
        });

        await nuevoPaciente.save();

        res.status(201).json({ message: "Paciente creado correctamente", paciente: nuevoPaciente });
    } catch (error) {
        console.error("Error al crear paciente:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

// 🔸 Listar pacientes por organización
export const listarPacientes = async (req, res) => {
    try {
        const pacientes = await Patient.find({ organizacion: req.user.organizacion }).sort({ createdAt: -1 });
        res.status(200).json(pacientes);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener pacientes" });
    }
};

// 🔸 Obtener un solo paciente
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

// 🔸 Actualizar paciente
export const actualizarPaciente = async (req, res) => {
    try {
        const paciente = await Patient.findOneAndUpdate(
            {
                _id: req.params.id,
                organizacion: req.user.organizacion,
            },
            req.body,
            { new: true }
        );

        if (!paciente) {
            return res.status(404).json({ message: "Paciente no encontrado" });
        }

        res.json({ message: "Paciente actualizado", paciente });
    } catch (error) {
        res.status(500).json({ message: "Error al actualizar paciente" });
    }
};

// 🔸 Eliminar paciente (solo Fundador)
export const eliminarPaciente = async (req, res) => {
    try {
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
