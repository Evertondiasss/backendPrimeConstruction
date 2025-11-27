  // backend/utils/s3.js
  import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
  import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
  import dotenv from "dotenv";

  dotenv.config();

  // 👉 Usa o mesmo padrão que já funcionava no server.js antigo
  export const s3 = new S3Client({
    region: process.env.AWS_REGION || process.env.S3_REGION || "sa-east-1",
    // NÃO passamos credentials manualmente:
    // o SDK vai buscar em:
    // - AWS_ACCESS_KEY_ID
    // - AWS_SECRET_ACCESS_KEY
    // - ou perfil configurado localmente
  });

  const SIGN_EXP = Number(process.env.S3_SIGN_EXPIRES || 300); // 5 minutos

  export async function presignGet(key) {
    if (!process.env.S3_BUCKET) {
      throw new Error("S3_BUCKET não definido no .env");
    }

    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
    });

    return getSignedUrl(s3, command, { expiresIn: SIGN_EXP });
  }
