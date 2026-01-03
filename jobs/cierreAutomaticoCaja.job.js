// mbcare-backend/jobs/cierreAutomaticoCaja.job.js
import cron from "node-cron";
import mongoose from "mongoose";

import CashRegister from "../models/CashRegister.js";
import Organization from "../models/Organization.js";

import { autoCerrarCajasVencidas } from "../services/cajaAutoHeal.service.js";
import { ZONA_HORARIA } from "../config/timezone.js";

const TZ = ZONA_HORARIA || "America/Bogota";

/**
 * 🔒 IMPORTANTE
 * Este job NO usa req (no hay request).
 * Para el actorUserId:
 * - Usamos el usuario creador de la organización (Fundador)
 * - Si no existe, usamos cualquier usuario válido de la organización
 *
 * Esto es necesario porque el consolidado mensual requiere creadoPor.
 */

/**
 * Obtiene un userId válido para una organización
 */
const obtenerActorSistema = async (organizacionId) => {
    const User = mongoose.model("User");

    // 1️⃣ Preferir Fundador activo
    let user = await User.findOne({
        organizacion: organizacionId,
        rol: "Fundador",
        activo: true,
    }).select("_id");

    // 2️⃣ Fallback: cualquier usuario activo
    if (!user) {
        user = await User.findOne({
            organizacion: organizacionId,
            activo: true,
        }).select("_id");
    }

    return user?._id || null;
};

/**
 * 🚀 JOB PRINCIPAL
 */
export const iniciarCierreAutomaticoCajaJob = () => {
    cron.schedule(
        "5 0 * * *", // ⏰ 00:05 todos los días
        async () => {
            console.log("⏰ [CRON] Iniciando cierre automático de cajas...");

            try {
                const organizaciones = await Organization.find().select("_id");

                for (const org of organizaciones) {
                    const organizacionId = org._id;

                    const actorUserId = await obtenerActorSistema(organizacionId);

                    if (!actorUserId) {
                        console.warn(
                            `⚠️ [CRON] Organización ${organizacionId} sin usuario válido. Se omite.`
                        );
                        continue;
                    }

                    const resultado = await autoCerrarCajasVencidas({
                        organizacionId,
                        actorUserId,
                        req: null, // cron ≠ request
                    });

                    if (resultado.cerradas > 0) {
                        console.log(
                            `✅ [CRON] Organización ${organizacionId}: ${resultado.cerradas} caja(s) cerrada(s).`
                        );
                    }
                }

                console.log("🏁 [CRON] Cierre automático de cajas finalizado.");
            } catch (error) {
                console.error(
                    "❌ [CRON] Error en cierre automático de cajas:",
                    error
                );
            }
        },
        {
            timezone: TZ,
        }
    );
};
