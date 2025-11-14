import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
dotenv.config();

const BUCKET = process.env.FILEBASE_BUCKET;

const s3 = new S3Client({
    region: process.env.FILEBASE_REGION,
    endpoint: process.env.FILEBASE_ENDPOINT,
    credentials: {
        accessKeyId: process.env.FILEBASE_KEY,
        secretAccessKey: process.env.FILEBASE_SECRET,
    },
    forcePathStyle: true, 
});

/**
 * 📤 Subir archivo a Filebase
 */
export const subirArchivoFilebase = async (file) => {
    const fileKey = `${uuidv4()}-${file.originalname}`;

    const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
    });

    await s3.send(command);

    return {
        url: `${process.env.FILEBASE_ENDPOINT}/${BUCKET}/${fileKey}`,
        public_id: fileKey,
        tipo: file.mimetype,
    };
};

/**
 * 🗑️ Eliminar archivo de Filebase
 */
export const eliminarArchivoFilebase = async (fileKey) => {
    const command = new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: fileKey,
    });

    await s3.send(command);
};
