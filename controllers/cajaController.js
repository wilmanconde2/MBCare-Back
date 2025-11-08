import CashRegister from "../models/CashRegister.js";

// 🟦 Abrir Caja del Día
export const abrirCaja = async (req, res) => {
    try {
        const { saldoInicial } = req.body;

        if (typeof saldoInicial !== "number" || saldoInicial < 0) {
            return res.status(400).json({ message: "El valor de apertura es requerido y debe ser válido." });
        }

        const existeCajaHoy = await CashRegister.findOne({
            fecha: new Date().toISOString().split("T")[0],
            profesional: req.user._id,
            organizacion: req.user.organizacion,
            abierta: true,
        });

        if (existeCajaHoy) {
            return res.status(400).json({ message: "Ya hay una caja abierta para hoy." });
        }

        const nuevaCaja = await CashRegister.create({
            saldoInicial,
            profesional: req.user._id,
            organizacion: req.user.organizacion,
            abierta: true,
            fecha: new Date().toISOString().split("T")[0],
        });

        res.status(201).json({
            message: "Caja del día abierta exitosamente.",
            caja: nuevaCaja,
        });
    } catch (error) {
        console.error("Error al abrir caja:", error);
        res.status(500).json({ message: "Error del servidor al abrir caja." });
    }
};
