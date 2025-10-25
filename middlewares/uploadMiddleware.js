import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";
import path from "path";

// 🎯 Tipos peligrosos que NO se deben permitir
const extensionesNoPermitidas = [".exe", ".sh", ".bat", ".cmd", ".js", ".php", ".py", ".rb"];
const tiposMimeNoPermitidos = [
    "application/x-msdownload",
    "application/x-sh",
    "application/x-bat",
    "application/javascript",
    "application/x-python-code",
    "application/x-ruby"
];

// ✅ Middleware personalizado para filtrar archivos antes de subirlos a Cloudinary
const fileFilter = (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;

    if (extensionesNoPermitidas.includes(extension) || tiposMimeNoPermitidos.includes(mime)) {
        return cb(new Error("Tipo de archivo no permitido por seguridad"), false);
    }

    cb(null, true);
};

// 📦 Configuración del almacenamiento con Cloudinary
const storage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
        const nombreArchivo = path.parse(file.originalname).name; // sin extensión
        return {
            folder: "mbcare/adjuntos",
            allowed_formats: ["jpg", "jpeg", "png", "pdf", "doc", "docx", "xlsx", "zip"],
            resource_type: "auto", // 👈 importante para admitir archivos raw (excel, doc, etc.)
            public_id: `${Date.now()}_${nombreArchivo}`, // evita duplicados
        };
    },
});

// 🧱 Middleware de subida
const upload = multer({ storage, fileFilter });

export default upload;
