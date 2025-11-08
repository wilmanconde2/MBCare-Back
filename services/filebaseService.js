import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
dotenv.config();

const s3 = new AWS.S3({
    accessKeyId: process.env.FILEBASE_KEY,
    secretAccessKey: process.env.FILEBASE_SECRET,
    endpoint: process.env.FILEBASE_ENDPOINT,
    region: process.env.FILEBASE_REGION,
    signatureVersion: "v4",
});

const BUCKET = process.env.FILEBASE_BUCKET;

/**
 * 📤 Subir archivo a Filebase
 */
export const subirArchivoFilebase = async (file) => {
    const fileKey = `${uuidv4()}-${file.originalname}`;

    const params = {
        Bucket: BUCKET,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
    };

    await s3.putObject(params).promise();

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
    const params = {
        Bucket: BUCKET,
        Key: fileKey,
    };

    await s3.deleteObject(params).promise();
};
