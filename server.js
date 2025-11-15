import express from "express";
import dotenv from "dotenv";
import cors from "cors";
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

// Rutas de auth y usuarios
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";

dotenv.config();
const app = express();

// 🔗 Conectar a la base de datos
connectDB();

// 🧱 Middlewares
app.use(cors());
app.use(express.json()); // Para leer body en formato JSON

// 📦 Rutas API
app.use("/api/auth", authRoutes);
app.use("/api/usuarios", userRoutes);
app.use("/api/pacientes", patientRoutes);
app.use("/api/organizacion", organizationRoutes);
app.use("/api/citas", appointmentRoutes);
app.use("/api/notas", noteRoutes);
app.use("/api/adjuntos", attachmentRoutes);
app.use("/api/configuracion", configuracionRoutes);
app.use("/api/caja", cajaRoutes);
app.use("/api/caja", cashflowRoutes);
app.use("/api/reportes", reportesRoutes);
app.use("/api/caja/resumen", resumenCajaRoutes);
app.use("/api/consolidado", consolidadoMensualRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/auditoria", auditoriaRoutes);

// 🟢 Puerto
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
});
