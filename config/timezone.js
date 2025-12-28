import moment from "moment-timezone";

// Zona horaria global del sistema
export const ZONA_HORARIA = "America/Bogota";

// ===== EXISTENTES (no se tocan) =====
export const inicioDelDia = (fecha = null) => {
    return (fecha ? moment.tz(fecha, ZONA_HORARIA) : moment().tz(ZONA_HORARIA))
        .startOf("day")
        .toDate();
};

export const finDelDia = (fecha = null) => {
    return (fecha ? moment.tz(fecha, ZONA_HORARIA) : moment().tz(ZONA_HORARIA))
        .endOf("day")
        .toDate();
};

export const fechaActual = () => {
    return moment().tz(ZONA_HORARIA).toDate();
};

export const fechaISO = () => {
    return moment().tz(ZONA_HORARIA).format("YYYY-MM-DD");
};

// ===== NUEVO: FECHA DE NEGOCIO =====

// Devuelve YYYY-MM-DD del negocio (Bogotá)
export const businessDateHoy = () => {
    return moment().tz(ZONA_HORARIA).format("YYYY-MM-DD");
};

// Convierte businessDate -> rango UTC real
export const rangoUTCDesdeBusinessDate = (businessDate) => {
    const inicio = moment.tz(businessDate, "YYYY-MM-DD", ZONA_HORARIA).startOf("day");
    const fin = inicio.clone().endOf("day");

    return {
        inicioUTC: inicio.toDate(),
        finUTC: fin.toDate(),
    };
};
