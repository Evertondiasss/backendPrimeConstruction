// backend/controllers/recebimentos.controller.js
import pool from '../config/db.js';
import { presignGet } from '../utils/s3.js'; // vamos criar esse util
import multer from 'multer';
import multerS3 from 'multer-s3';
import { s3 } from '../utils/s3.js';

const S3_BUCKET = process.env.S3_BUCKET;
const PREFIX = process.env.S3_PREFIX_RECEBIMENTOS || 'recebimentos/';

// ============ UPLOAD (Multer-S3) ============
export const uploadRecebimentos = multer({
  storage: multerS3({
    s3,
    bucket: S3_BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: (req, file, cb) => cb(null, { fieldName: file.fieldname }),
    key: (req, file, cb) => {
      const safe = file.originalname.replace(/[^\w.\-]+/g, '_');
      cb(null, `${PREFIX}${Date.now()}__${safe}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype);
    if (ok) return cb(null, true);
    return cb(new Error('Formato inválido (PDF, PNG, JPG, WEBP).'));
  }
});

// ===============================
// GET /api/recebimentos_obra
// ===============================
export async function listarRecebimentos(req, res) {
  try {
    const sql = `
      SELECT r.id, r.obra_id, o.nome AS obra_nome,
             r.valor, r.tipo, 
             DATE_FORMAT(r.data_recebimento,'%d/%m/%Y') AS data_recebimento,
             r.comprovante_url, r.observacoes,
             DATE_FORMAT(r.created_at,'%d-%m-%Y %H:%i:%s') AS created_at
        FROM recebimentos_obra r
   LEFT JOIN obras o ON o.id = r.obra_id
    ORDER BY r.id DESC
    `;

    const [rows] = await pool.query(sql);

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
    console.error('GET /api/recebimentos_obra', e);
    res.status(500).json({ error: 'Erro ao listar recebimentos.' });
  }
}

// ===============================
// POST /api/recebimentos_obra
// ===============================
export async function criarRecebimento(req, res) {
  try {
    const { obra_id, valor, tipo, data_recebimento, observacoes } = req.body;

    if (!obra_id || !valor || !tipo || !data_recebimento) {
      return res.status(400).json({ error: 'Campos obrigatórios: obra_id, valor, tipo, data_recebimento.' });
    }

    const obraId = Number(obra_id);
    const valorNum = Number(valor);

    if (!Number.isInteger(obraId) || obraId <= 0) {
      return res.status(400).json({ error: 'obra_id inválido.' });
    }
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      return res.status(400).json({ error: 'Valor inválido.' });
    }
    if (!['parcial', 'integral'].includes(String(tipo))) {
      return res.status(400).json({ error: "tipo deve ser 'parcial' ou 'integral'." });
    }

    const [[obra]] = await pool.query('SELECT id FROM obras WHERE id = ? LIMIT 1', [obraId]);
    if (!obra) return res.status(400).json({ error: 'Obra inexistente.' });

    const s3Key = req.file?.key || null;

    const sql = `
      INSERT INTO recebimentos_obra
        (obra_id, valor, tipo, data_recebimento, comprovante_url, observacoes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `;

    const [result] = await pool.query(sql, [
      obraId,
      valorNum,
      tipo,
      data_recebimento,
      s3Key,
      observacoes ?? null
    ]);

    let comprovante_presigned = null;
    if (s3Key) {
      try {
        comprovante_presigned = await presignGet(s3Key);
      } catch {}
    }

    res.status(201).json({
      id: result.insertId,
      obra_id: obraId,
      valor: valorNum,
      tipo,
      data_recebimento,
      comprovante_url: s3Key,
      comprovante_presigned,
      observacoes: observacoes ?? null,
    });

  } catch (e) {
    console.error('POST /api/recebimentos_obra', e);
    res.status(500).json({ error: 'Erro ao registrar recebimento.' });
  }
}

// ===============================
// DELETE /api/recebimentos_obra/:id
// ===============================
export async function excluirRecebimento(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID inválido.' });
    }

    const [[existe]] = await pool.query('SELECT id FROM recebimentos_obra WHERE id = ?', [id]);
    if (!existe) return res.status(404).json({ error: 'Registro não encontrado.' });

    const [r] = await pool.query('DELETE FROM recebimentos_obra WHERE id = ?', [id]);

    res.json({ ok: true, afetado: r.affectedRows });

  } catch (e) {
    console.error('DELETE /api/recebimentos_obra/:id', e);
    res.status(500).json({ error: 'Erro ao excluir recebimento.' });
  }
}
