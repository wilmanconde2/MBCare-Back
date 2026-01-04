// mbcare-backend/server.js

import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import connectDB from "./config/db.js";

// ✅ CRON JOB (cierre automático)
import { iniciarCierreAutomaticoCajaJob } from "./jobs/cierreAutomaticoCaja.job.js";

// Rutas principales
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import patientRoutes from "./routes/patientRoutes.js";
import organizationRoutes from "./routes/organizationRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import noteRoutes from "./routes/noteRoutes.js";
import attachmentRoutes from "./routes/attachmentRoutes.js";
import configuracionRoutes from "./routes/configuracionRoutes.js";

// Contabilidad
import cajaRoutes from "./routes/cajaRoutes.js";
import cashflowRoutes from "./routes/cashflowRoutes.js";
import consolidadoMensualRoutes from "./routes/consolidadoMensualRoutes.js";
import reportesRoutes from "./routes/reportesRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import auditoriaRoutes from "./routes/auditoriaRoutes.js";

import { errorHandler } from "./middlewares/errorHandler.js";

dotenv.config();
const app = express();

// 🔌 DB
connectDB();

// 🌍 Middlewares globales
app.use(express.json());
app.use(cookieParser());

// 🌐 CORS (React)
app.use(
    cors({
        origin: "http://localhost:5173",
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

// =========================
// 🚀 RUTAS API
// =========================

// Auth y usuarios
app.use("/api/auth", authRoutes);
app.use("/api/usuarios", userRoutes);

// Core
app.use("/api/pacientes", patientRoutes);
app.use("/api/organizacion", organizationRoutes);
app.use("/api/citas", appointmentRoutes);
app.use("/api/notas", noteRoutes);
app.use("/api/adjuntos", attachmentRoutes);
app.use("/api/configuracion", configuracionRoutes);

// 💰 CONTABILIDAD (orden lógico)
app.use("/api/caja", cajaRoutes); // abrir, cerrar, estado, resumen
app.use("/api/flujo-caja", cashflowRoutes); // transacciones, ingresos, egresos
app.use("/api/consolidado", consolidadoMensualRoutes);

// 📊 Reportes y métricas
app.use("/api/reportes", reportesRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/auditoria", auditoriaRoutes);

// 🧨 Errores (SIEMPRE al final)
app.use(errorHandler);

// 🚪 Puerto
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);

    // ✅ Iniciar CRON cuando el servidor ya está arriba
    iniciarCierreAutomaticoCajaJob();
    console.log("⏰ CRON de cierre automático de cajas activo.");
});
