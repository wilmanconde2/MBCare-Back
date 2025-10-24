const permissionsMatrix = {
    pacientes: {
        listar: ["Fundador", "Profesional", "Asistente"],
        crear: ["Fundador", "Profesional", "Asistente"],
        editar: ["Fundador", "Profesional", "Asistente"],
        eliminar: ["Fundador"],
    },
    citas: {
        ver: ["Fundador", "Profesional", "Asistente"],
        crear: ["Fundador", "Profesional", "Asistente"],
        eliminar: ["Fundador", "Profesional", "Asistente"],
    },
    notas: {
        ver: ["Fundador", "Profesional"],
        crear: ["Fundador", "Profesional"],
        eliminar: ["Fundador", "Profesional"],
    },
    adjuntos: {
        subir: ["Fundador", "Profesional"],
    },
    configuracion: {
        acceder: ["Fundador"],
    },
    reportes: {
        ver: ["Fundador", "Profesional"],
        exportar: ["Fundador"],
    },
};

/**
 * Middleware que permite acceso por:
 * 1. Rol global: hasAccess("Fundador")
 * 2. Permiso granular: hasAccess("pacientes", "eliminar")
 */
export const hasAccess = (moduloOrRol, accion = null) => {
    return (req, res, next) => {
        const rol = req.user?.rol;

        if (!rol) {
            return res.status(401).json({ message: "Token inválido o faltante." });
        }

        // 🔒 Control global por rol (solo se pasa un argumento)
        if (!accion) {
            const rolesPermitidos = Array.isArray(moduloOrRol)
                ? moduloOrRol
                : [moduloOrRol];

            if (!rolesPermitidos.includes(rol)) {
                return res.status(403).json({ message: "Acceso denegado (rol)." });
            }

            return next();
        }

        // 🔐 Control granular por módulo/acción
        const permisosModulo = permissionsMatrix[moduloOrRol];

        if (!permisosModulo || !permisosModulo[accion]) {
            return res.status(403).json({ message: "Permiso no definido." });
        }

        if (!permisosModulo[accion].includes(rol)) {
            return res.status(403).json({ message: "No tienes permiso para esta acción." });
        }

        next();
    };
};
