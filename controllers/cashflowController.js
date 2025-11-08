import Transaction from "../models/Transaction.js";
import CashRegister from "../models/CashRegister.js";

// ➕ Crear ingreso o egreso
export const crearTransaccion = async (req, res) => {
    try {
        const { tipo, descripcion, monto, metodoPago } = req.body;

        if (!tipo || !descripcion || monto === undefined) {
            return res.status(400).json({ message: "Todos los campos son obligatorios." });
        }

        if (!["Ingreso", "Egreso"].includes(tipo)) {
            return res.status(400).json({ message: "Tipo inválido." });
        }

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const mañana = new Date(hoy);
        mañana.setDate(mañana.getDate() + 1);

        const caja = await CashRegister.findOne({
            fecha: { $gte: hoy, $lt: mañana },
            organizacion: req.user.organizacion,
            abierta: true,
        });

        if (!caja) {
            return res.status(400).json({ message: "No hay una caja abierta para hoy." });
        }

        const transaccion = await Transaction.create({
            tipo,
            descripcion,
            monto,
            metodoPago,
            caja: caja._id,
            profesional: req.user._id,
            organizacion: req.user.organizacion,
        });

        res.status(201).json({ message: "Transacción registrada exitosamente.", transaccion });
    } catch (error) {
        console.error("Error al crear transacción:", error);
        res.status(500).json({ message: "Error del servidor." });
    }
};

// 🔍 Listar transacciones por ID de caja
export const listarPorCaja = async (req, res) => {
    try {
        const { cajaId } = req.params;

        const transacciones = await Transaction.find({
            caja: cajaId,
            organizacion: req.user.organizacion,
        }).sort({ createdAt: -1 });

        res.status(200).json({ transacciones });
    } catch (error) {
        console.error("Error al listar transacciones:", error);
        res.status(500).json({ message: "Error del servidor." });
    }
};

// 📆 Listar transacciones por fecha específica
export const listarPorFecha = async (req, res) => {
    try {
        const { fecha } = req.query;

        if (!fecha) {
            return res.status(400).json({ message: "La fecha es obligatoria." });
        }

        const inicioDia = new Date(fecha);
        inicioDia.setHours(0, 0, 0, 0);
        const finDia = new Date(inicioDia);
        finDia.setDate(finDia.getDate() + 1);

        const transacciones = await Transaction.find({
            createdAt: { $gte: inicioDia, $lt: finDia },
            organizacion: req.user.organizacion,
        }).sort({ createdAt: -1 });

        res.status(200).json({ transacciones });
    } catch (error) {
        console.error("Error al filtrar transacciones por fecha:", error);
        res.status(500).json({ message: "Error del servidor." });
    }
};

// 📝 Editar una transacción
export const editarTransaccion = async (req, res) => {
    try {
        const { id } = req.params;
        const { descripcion, monto, metodoPago } = req.body;

        const transaccion = await Transaction.findById(id);
        if (!transaccion || transaccion.organizacion.toString() !== req.user.organizacion.toString()) {
            return res.status(404).json({ message: "Transacción no encontrada." });
        }

        const esFundador = req.user.rol === "Fundador";
        const esAutor = transaccion.profesional.toString() === req.user._id.toString();
        if (!esFundador && !esAutor) {
            return res.status(403).json({ message: "No tienes permisos para editar esta transacción." });
        }

        transaccion.descripcion = descripcion || transaccion.descripcion;
        transaccion.monto = monto !== undefined ? monto : transaccion.monto;
        transaccion.metodoPago = metodoPago || transaccion.metodoPago;

        await transaccion.save();

        res.status(200).json({ message: "Transacción actualizada exitosamente.", transaccion });
    } catch (error) {
        console.error("Error al editar transacción:", error);
        res.status(500).json({ message: "Error del servidor." });
    }
};

// 🗑️ Eliminar una transacción
export const eliminarTransaccion = async (req, res) => {
    try {
        const { id } = req.params;

        const transaccion = await Transaction.findById(id);
        if (!transaccion || transaccion.organizacion.toString() !== req.user.organizacion.toString()) {
            return res.status(404).json({ message: "Transacción no encontrada." });
        }

        const esFundador = req.user.rol === "Fundador";
        const esAutor = transaccion.profesional.toString() === req.user._id.toString();
        if (!esFundador && !esAutor) {
            return res.status(403).json({ message: "No tienes permisos para eliminar esta transacción." });
        }

        await transaccion.deleteOne();
        res.status(200).json({ message: "Transacción eliminada exitosamente." });
    } catch (error) {
        console.error("Error al eliminar transacción:", error);
        res.status(500).json({ message: "Error del servidor." });
    }
};
