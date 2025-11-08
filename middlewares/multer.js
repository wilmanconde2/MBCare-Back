import multer from "multer";

// 📦 Almacenamiento en memoria para subir a Filebase
const storage = multer.memoryStorage();

export const upload = multer({ storage });
