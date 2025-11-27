// backend/controllers/encargos.controller.js
import pool from "../config/db.js";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cliente S3 só para gerar URL assinada
const s3 = new S3Client({ region: process.env.AWS_REGION });
const S3_BUCKET = process.env.S3_BUCKET;
const SIGN_EXP = Number(process.env.S3_SIGN_EXPIRES || 300);

async function presignGet(key) {
  if (!key) return null;
  const cmd = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });
  return await getSignedUrl(s3, cmd, { expiresIn: SIGN_EXP });
}

// ===============================
// GET /api/encargos
// ===============================
export async function listarEncargos(req, res) {
  try {
    const sql = `
      SELECT e.id,
             e.obra_id,
             o.nome AS obra_nome,
             e.tipo,
             e.valor,
             e.comprovante_url,
             e.created_at
        FROM encargos e
   LEFT JOIN obras o ON o.id = e.obra_id
    ORDER BY e.id DESC
    `;

    const conn = await pool.getConnection();
    const [rows] = await conn.query(sql);
    conn.release();

    const withSigned = await Promise.all(
      rows.map(async (r) => {
        if (r.comprovante_url) {
          try {
            r.comprovante_presigned = await presignGet(r.comprovante_url);
          } catch {
            r.comprovante_presigned = null;
          }
        }
        return r;
      })
    );

    res.json(withSigned);
  } catch (e) {
    console.error("GET /api/encargos ERRO:", e.message || e);
    res.status(500).json({ error: "Erro ao listar encargos." });
  }
}

// ===============================
// POST /api/encargos
// ===============================
export async function criarEncargo(req, res) {
  try {
    const { obra_id, tipo, valor } = req.body;

    if (!obra_id || !tipo || !valor) {
      return res.status(400).json({
        error: "Campos obrigatórios: obra_id, tipo, valor.",
      });
    }

    const valorNum = Number(valor);
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      return res.status(400).json({ error: "Valor inválido." });
    }

    // multer-s3 devolve req.file.key e req.file.location
    const s3Key = req.file?.key || null;
    const s3Url = req.file?.location || null;

    const sql = `
      INSERT INTO encargos (obra_id, tipo, valor, comprovante_url, created_at)
      VALUES (?, ?, ?, ?, NOW())
    `;

    const conn = await pool.getConnection();
    const [result] = await conn.query(sql, [
      Number(obra_id),
      tipo,
      valorNum,
      s3Key,
    ]);
    conn.release();

    res.status(201).json({
      id: result.insertId,
      obra_id: Number(obra_id),
      tipo,
      valor: valorNum,
      comprovante_url: s3Key, // KEY no S3
      location: s3Url, // opcional — URL pública (se o bucket permitir)
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Erro ao registrar encargo:", err.message || err);
    res.status(500).json({ error: "Erro ao registrar encargo." });
  }
}
