// mbcare-backend/routes/auditoriaRoutes.js

import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { hasAccess } from "../middlewares/hasAccess.js";
import LogAuditoria from "../models/LogAuditoria.js";

const router = express.Router();

router.get("/", protect, hasAccess(["Fundador"]), async (req, res) => {
    try {
        const logs = await LogAuditoria.find({
            organizacion: req.user.organizacion
        })
            .populate({
                path: "usuario",
                model: "User",  
                select: "nombre email"
            })
            .sort({ createdAt: -1 })
            .limit(200);

        res.status(200).json(logs);

    } catch (error) {
        console.error("Error al obtener auditoría:", error);
        res.status(500).json({ message: "Error al obtener registros de auditoría." });
    }
});

export default router;
