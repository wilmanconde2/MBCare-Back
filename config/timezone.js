import moment from "moment-timezone";

// Zona horaria global del sistema
const ZONA_HORARIA = "America/Bogota";

// Devuelve el inicio del día (00:00:00) en zona horaria
export const inicioDelDia = (fecha = null) => {
    return (fecha ? moment.tz(fecha, ZONA_HORARIA) : moment().tz(ZONA_HORARIA)).startOf("day").toDate();
};

// Devuelve el fin del día (23:59:59) en zona horaria
export const finDelDia = (fecha = null) => {
    return (fecha ? moment.tz(fecha, ZONA_HORARIA) : moment().tz(ZONA_HORARIA)).endOf("day").toDate();
};

// Devuelve fecha actual en zona horaria
export const fechaActual = () => {
    return moment().tz(ZONA_HORARIA).toDate();
};

// Devuelve fecha actual como YYYY-MM-DD en zona horaria
export const fechaISO = () => {
    return moment().tz(ZONA_HORARIA).format("YYYY-MM-DD");
};
