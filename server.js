// mbcare-backend/server.js

import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import connectDB from "./config/db.js";

// ✅ CRON JOB
import { iniciarCierreAutomaticoCajaJob } from "./jobs/cierreAutomaticoCaja.job.js";

// Rutas
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import patientRoutes from "./routes/patientRoutes.js";
import organizationRoutes from "./routes/organizationRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import noteRoutes from "./routes/noteRoutes.js";
import attachmentRoutes from "./routes/attachmentRoutes.js";
import configuracionRoutes from "./routes/configuracionRoutes.js";

import cajaRoutes from "./routes/cajaRoutes.js";
import cashflowRoutes from "./routes/cashflowRoutes.js";
import consolidadoMensualRoutes from "./routes/consolidadoMensualRoutes.js";
import reportesRoutes from "./routes/reportesRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import auditoriaRoutes from "./routes/auditoriaRoutes.js";

import { errorHandler } from "./middlewares/errorHandler.js";

dotenv.config();
const app = express();

// =========================
// 🔌 DB
// =========================
connectDB();

// =========================
// 🌍 Middlewares globales
// =========================
app.use(express.json());
app.use(cookieParser());

// =========================
// 🌐 CORS dinámico por ENV
// =========================
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map(o => o.trim())
    .filter(Boolean);

app.use(
    cors({
        origin: function (origin, cb) {
            // Permite Postman, cron, curl
            if (!origin) return cb(null, true);

            if (allowedOrigins.includes(origin)) {
                return cb(null, true);
            }

            return cb(new Error(`CORS bloqueado para: ${origin}`), false);
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

// =========================
// 🚀 RUTAS API
// =========================
app.use("/api/auth", authRoutes);
app.use("/api/usuarios", userRoutes);

app.use("/api/pacientes", patientRoutes);
app.use("/api/organizacion", organizationRoutes);
app.use("/api/citas", appointmentRoutes);
app.use("/api/notas", noteRoutes);
app.use("/api/adjuntos", attachmentRoutes);
app.use("/api/configuracion", configuracionRoutes);

app.use("/api/caja", cajaRoutes);
app.use("/api/flujo-caja", cashflowRoutes);
app.use("/api/consolidado", consolidadoMensualRoutes);

app.use("/api/reportes", reportesRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/auditoria", auditoriaRoutes);

// =========================
// 🧨 Errores
// =========================
app.use(errorHandler);

// =========================
// 🚪 Puerto
// =========================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Backend corriendo en puerto ${PORT}`);

    const enableCron = process.env.ENABLE_CRON === "true";

    if (enableCron) {
        iniciarCierreAutomaticoCajaJob();
        console.log("⏰ CRON de cierre automático ACTIVADO");
    } else {
        console.log("⏸️ CRON DESACTIVADO (ENABLE_CRON != true)");
    }
});
