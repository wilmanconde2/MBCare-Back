import CashRegister from "../models/CashRegister.js";
import Transaction from "../models/Transaction.js";

// 🟦 Abrir Caja del Día
export const abrirCaja = async (req, res) => {
    try {
        const { saldoInicial } = req.body;

        if (typeof saldoInicial !== "number" || saldoInicial < 0) {
            return res.status(400).json({ message: "El valor de apertura es requerido y debe ser válido." });
        }

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const mañana = new Date(hoy);
        mañana.setDate(mañana.getDate() + 1);

        const existeCajaHoy = await CashRegister.findOne({
            fecha: { $gte: hoy, $lt: mañana },
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
            fecha: hoy,
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

// 🔒 Cerrar Caja del Día
export const cerrarCaja = async (req, res) => {
    try {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const mañana = new Date(hoy);
        mañana.setDate(mañana.getDate() + 1);

        const caja = await CashRegister.findOne({
            fecha: { $gte: hoy, $lt: mañana },
            profesional: req.user._id,
            organizacion: req.user.organizacion,
            abierta: true,
        });

        if (!caja) {
            return res.status(404).json({ message: "No hay una caja abierta para hoy." });
        }

        // Obtener transacciones del día
        const transacciones = await Transaction.find({
            caja: caja._id,
            organizacion: req.user.organizacion,
        });

        const totalIngresos = transacciones.filter(t => t.tipo === "Ingreso").reduce((acc, t) => acc + t.monto, 0);
        const totalEgresos = transacciones.filter(t => t.tipo === "Egreso").reduce((acc, t) => acc + t.monto, 0);

        const saldoFinal = caja.saldoInicial + totalIngresos - totalEgresos;

        caja.abierta = false;
        caja.saldoFinal = saldoFinal;
        await caja.save();

        res.status(200).json({
            message: "Caja cerrada exitosamente.",
            caja,
            resumen: {
                ingresos: totalIngresos,
                egresos: totalEgresos,
                saldoFinal,
            },
        });
    } catch (error) {
        console.error("Error al cerrar caja:", error);
        res.status(500).json({ message: "Error del servidor al cerrar caja." });
    }
};
