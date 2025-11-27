// backend/controllers/pagamentos.controller.js
import multer from "multer";
import multerS3 from "multer-s3";

import pool from "../config/db.js";
import { s3, presignGet } from "../utils/s3.js";

const S3_BUCKET = process.env.S3_BUCKET;


/* ======================================================================
 * UPLOAD S3 - PAGAMENTOS FUNCIONÁRIOS
 * ====================================================================*/
const uploadPag = multer({
  storage: multerS3({
    s3,
    bucket: S3_BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: (req, file, cb) => cb(null, { fieldName: file.fieldname }),
    key: (req, file, cb) => {
      const safe = file.originalname.replace(/[^\w.\-]+/g, "_");
      const prefix = process.env.S3_PREFIX_PAGAMENTOS || "pagamentos/";
      cb(null, `${prefix}${Date.now()}__${safe}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const ok = ["application/pdf", "image/png", "image/jpeg"].includes(
      file.mimetype
    );
    if (ok) return cb(null, true);
    return cb(new Error("Formato inválido (PDF/PNG/JPG)."));
  },
});

// middleware exportado pro router
export const uploadPagamentosMiddleware = uploadPag.any();

/* ======================================================================
 * LISTAR PAGAMENTOS
 * GET /api/pagamentos-funcionarios
 * ====================================================================*/
export async function listarPagamentos(req, res) {
  try {
    const [rows] = await pool.query(
      `
      SELECT p.id, p.funcionario_id,
             DATE_FORMAT(p.competencia,   '%d/%m/%Y') AS competencia,
             DATE_FORMAT(p.data_pagamento,'%d/%m/%Y') AS data_pagamento,
             p.valor_pago, p.extras_total, p.comprovante_path,
             f.nome AS nome_funcionario, f.cpf AS cpf_funcionario, f.cargo AS cargo_funcionario
      FROM pagamentos_funcionarios p
      JOIN funcionarios f ON f.id = p.funcionario_id
      ORDER BY p.data_pagamento DESC, p.id DESC
    `
    );

    const enriched = await Promise.all(
      rows.map(async (r) => ({
        ...r,
        comprovante_url: r.comprovante_path
          ? await presignGet(r.comprovante_path)
          : null,
      }))
    );

    res.json(enriched);
  } catch (e) {
    console.error(
      "GET /api/pagamentos-funcionarios",
      e.code,
      e.sqlMessage || e.message
    );
    res.status(500).json({ error: "Erro ao listar pagamentos" });
  }
}

/* ======================================================================
 * HELPER: pagamento completo por ID
 * ====================================================================*/
async function getPagamentoCompletoById(id) {
  const [[p]] = await pool.query(
    `
    SELECT p.id, p.funcionario_id,
           DATE_FORMAT(p.competencia,'%d/%m/%Y')   AS competencia,
           DATE_FORMAT(p.data_pagamento,'%d/%m/%Y') AS data_pagamento,
           p.valor_pago, p.extras_total, p.comprovante_path, p.observacoes,
           f.nome AS nome_funcionario, f.cpf AS cpf_funcionario, f.cargo AS cargo_funcionario
      FROM pagamentos_funcionarios p
      JOIN funcionarios f ON f.id = p.funcionario_id
     WHERE p.id = ? LIMIT 1
  `,
    [id]
  );

  if (!p) return null;

  p.comprovante_url = p.comprovante_path
    ? await presignGet(p.comprovante_path)
    : null;

  const [extras] = await pool.query(
    `
    SELECT e.id, e.obra_id, o.nome AS obra_nome,
           e.horas_qtd, e.valor_hora, (e.horas_qtd*e.valor_hora) AS total_linha,
           DATE_FORMAT(e.created_at,'%d-%m-%Y %H:%i:%s') AS created_at
      FROM pagamentos_horas_extras e
      JOIN obras o ON o.id = e.obra_id
     WHERE e.pagamento_id = ?
     ORDER BY o.nome, e.id
  `,
    [id]
  );

  p.extras = extras;
  return p;
}

/* ======================================================================
 * DETALHAR PAGAMENTO
 * GET /api/pagamentos-funcionarios/:id
 * ====================================================================*/
export async function detalharPagamento(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const pgto = await getPagamentoCompletoById(id);
    if (!pgto) {
      return res.status(404).json({ error: "Pagamento não encontrado" });
    }

    res.json(pgto);
  } catch (e) {
    console.error("GET /api/pagamentos-funcionarios/:id", e);
    res.status(500).json({ error: "Erro ao detalhar pagamento" });
  }
}

/* ======================================================================
 * CRIAR PAGAMENTO
 * POST /api/pagamentos-funcionarios
 * ====================================================================*/
export async function criarPagamento(req, res) {
  // uploadPag.any() já rodou antes, aqui só tratamos req.files
  if (Array.isArray(req.files) && req.files.length > 0) {
    req.file = req.files[0];
  }

  const conn = await pool.getConnection();
  try {
    const { funcionario_id, competencia, data_pagamento, valor_pago, observacoes } =
      req.body;

    // extras vem como JSON string
    let extras = [];
    try {
      extras = JSON.parse(req.body.extras || "[]");
    } catch {
      extras = [];
    }
    extras = Array.isArray(extras) ? extras : [];

    if (!funcionario_id || !competencia || !data_pagamento || valor_pago == null) {
      return res
        .status(400)
        .json({ error: "Preencha todos os campos obrigatórios." });
    }

    const funcId = Number(funcionario_id);
    const valor = Number(valor_pago);
    if (!Number.isInteger(funcId) || funcId <= 0) {
      return res.status(400).json({ error: "Funcionário inválido." });
    }
    if (!Number.isFinite(valor) || valor < 0) {
      return res.status(400).json({ error: "Valor inválido." });
    }

    const [fx] = await pool.query(
      "SELECT id FROM funcionarios WHERE id = ? LIMIT 1",
      [funcId]
    );
    if (!fx.length) {
      return res.status(400).json({ error: "Funcionário inexistente." });
    }

    const fileKey = req.file?.key || null;

    await conn.beginTransaction();

    // cabeçalho
    const [r] = await conn.query(
      `
      INSERT INTO pagamentos_funcionarios
        (funcionario_id, competencia, data_pagamento, valor_pago, comprovante_path, observacoes)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      [funcId, competencia, data_pagamento, valor, fileKey, observacoes ?? null]
    );
    const pagamentoId = r.insertId;

    // horas extras (cada linha precisa de obra_id, horas_qtd, valor_hora)
    const extrasArr = extras.filter(
      (e) =>
        Number(e.obra_id) > 0 &&
        Number(e.horas_qtd) > 0 &&
        Number(e.valor_hora) >= 0
    );

    if (extrasArr.length) {
      const placeholders = extrasArr
        .map(() => "(?, ?, ?, ?, NOW())")
        .join(", ");
      const vals = extrasArr.flatMap((e) => [
        pagamentoId,
        Number(e.obra_id),
        Number(e.horas_qtd),
        Number(e.valor_hora),
      ]);

      await conn.query(
        `
        INSERT INTO pagamentos_horas_extras
          (pagamento_id, obra_id, horas_qtd, valor_hora, created_at)
        VALUES ${placeholders}
      `,
        vals
      );

      // Atualiza extras_total
      await conn.query(
        `
        UPDATE pagamentos_funcionarios pf
           SET extras_total = (
             SELECT COALESCE(SUM(horas_qtd * valor_hora), 0)
               FROM pagamentos_horas_extras
              WHERE pagamento_id = pf.id
           )
         WHERE pf.id = ?
      `,
        [pagamentoId]
      );
    }

    await conn.commit();
    return res.status(201).json({ ok: true, id: pagamentoId });
  } catch (e) {
    await conn.rollback();
    if (e.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: "Já existe pagamento para este funcionário neste mês.",
      });
    }
    console.error("POST /api/pagamentos-funcionarios", e);
    return res
      .status(500)
      .json({ error: "Erro ao registrar pagamento." });
  } finally {
    conn.release();
  }
}
