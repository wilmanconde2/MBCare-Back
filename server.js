import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import connectDB from "./config/db.js";

import patientRoutes from "./routes/patientRoutes.js";
import organizationRoutes from "./routes/organizationRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import noteRoutes from "./routes/noteRoutes.js";
import attachmentRoutes from "./routes/attachmentRoutes.js";
import configuracionRoutes from "./routes/configuracionRoutes.js";
import cajaRoutes from "./routes/cajaRoutes.js";
import cashflowRoutes from "./routes/cashflowRoutes.js";
import reportesRoutes from "./routes/reportesRoutes.js";
import resumenCajaRoutes from "./routes/resumenCajaRoutes.js";
import consolidadoMensualRoutes from "./routes/consolidadoMensualRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import auditoriaRoutes from "./routes/auditoriaRoutes.js";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";

import { errorHandler } from "./middlewares/errorHandler.js";

dotenv.config();
const app = express();

// Conectar a la base de datos
connectDB();

// Middlewares globales
app.use(express.json());
app.use(cookieParser());

// CORS CONFIGURADO CORRECTAMENTE PARA REACT
app.use(cors({
    origin: "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

// RUTAS DEL API
app.use("/api/auth", authRoutes);
app.use("/api/usuarios", userRoutes);
app.use("/api/pacientes", patientRoutes);
app.use("/api/organizacion", organizationRoutes);
app.use("/api/citas", appointmentRoutes);
app.use("/api/notas", noteRoutes);
app.use("/api/adjuntos", attachmentRoutes);
app.use("/api/configuracion", configuracionRoutes);
app.use("/api/caja", cajaRoutes);
app.use("/api/caja/flujo", cashflowRoutes);
app.use("/api/reportes", reportesRoutes);
app.use("/api/caja/resumen", resumenCajaRoutes);
app.use("/api/consolidado", consolidadoMensualRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/auditoria", auditoriaRoutes);

// Manejador de errores
app.use(errorHandler);

// Puerto
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
});
