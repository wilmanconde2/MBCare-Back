import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import patientRoutes from "./routes/patientRoutes.js";
import organizationRoutes from "./routes/organizationRoutes.js"; 
import appointmentRoutes from "./routes/appointmentRoutes.js";
import noteRoutes from "./routes/noteRoutes.js";

// Rutas
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


// 🟢 Puerto
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
});
