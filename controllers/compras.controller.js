// controllers/compras.controller.js
import pool from '../config/db.js';
import { presignGet } from '../utils/s3.js';

// LISTAR compras (cabeçalho + agregados)
// GET /api/compras
export const listarCompras = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        c.id,
        DATE_FORMAT(c.data_compra,     '%d/%m/%Y') AS data_compra,
        DATE_FORMAT(c.data_vencimento, '%d/%m/%Y') AS data_vencimento,
        c.forma_pagamento,
        c.parcelas,
        c.observacoes,
        c.desconto_total,
        c.total_liquido,
        c.comprovante_path,
        o.nome  AS obra_nome,
        f.nome  AS fornecedor_nome,
        fu.nome AS funcionario_nome,
        COUNT(ci.id) AS qtd_itens
      FROM compras c
      JOIN obras o         ON o.id  = c.obra_id
      JOIN fornecedores f  ON f.id  = c.fornecedor_id
      JOIN funcionarios fu ON fu.id = c.funcionario_id
      LEFT JOIN compras_itens ci ON ci.compra_id = c.id
      GROUP BY c.id
      ORDER BY c.id DESC
    `);

    const prefixCompras = (process.env.S3_PREFIX_COMPRAS || 'compras/');

    const enriched = await Promise.all(
      rows.map(async (r) => {
        const isS3 = r.comprovante_path && r.comprovante_path.startsWith(prefixCompras);

        const comprovante_url = r.comprovante_path
          ? (isS3
              ? await presignGet(r.comprovante_path)
              : `${req.protocol}://${req.get('host')}/uploads/compras/${r.comprovante_path}`)
          : null;

        return { ...r, comprovante_url };
      })
    );

    res.json(enriched);
  } catch (e) {
    console.error('GET /api/compras', e);
    res.status(500).json({ error: 'Erro ao listar compras' });
  }
};

// DETALHAR uma compra com itens
// GET /api/compras/:id
export const detalharCompra = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const [[cab]] = await pool.query(
      `
      SELECT c.*,
             DATE_FORMAT(c.data_compra,     '%d/%m/%Y') AS data_compra_fmt,
             DATE_FORMAT(c.data_vencimento, '%d/%m/%Y') AS data_vencimento_fmt,
             o.nome  AS obra_nome,
             f.nome  AS fornecedor_nome,
             fu.nome AS funcionario_nome
      FROM compras c
      JOIN obras o         ON o.id  = c.obra_id
      JOIN fornecedores f  ON f.id  = c.fornecedor_id
      JOIN funcionarios fu ON fu.id = c.funcionario_id
      WHERE c.id = ?
      LIMIT 1
      `,
      [id]
    );

    if (!cab) {
      return res.status(404).json({ error: 'Compra não encontrada' });
    }

    const [itens] = await pool.query(
      `
      SELECT ci.id, ci.produto_id, p.nome AS produto_nome,
             ci.quantidade, ci.valor_unit, ci.desconto_item, ci.total_item
      FROM compras_itens ci
      JOIN produtos p ON p.id = ci.produto_id
      WHERE ci.compra_id = ?
      ORDER BY ci.id
      `,
      [id]
    );

    const prefixCompras = (process.env.S3_PREFIX_COMPRAS || 'compras/');
    const isS3 = cab.comprovante_path && cab.comprovante_path.startsWith(prefixCompras);

    const comprovante_url = cab.comprovante_path
      ? (isS3
          ? await presignGet(cab.comprovante_path)
          : `${req.protocol}://${req.get('host')}/uploads/compras/${cab.comprovante_path}`)
      : null;

    res.json({
      id: cab.id,
      obra_id: cab.obra_id,
      fornecedor_id: cab.fornecedor_id,
      funcionario_id: cab.funcionario_id,
      data_compra: cab.data_compra_fmt,
      data_vencimento: cab.data_vencimento_fmt,
      forma_pagamento: cab.forma_pagamento,
      parcelas: cab.parcelas,
      observacoes: cab.observacoes,
      desconto_total: cab.desconto_total,
      total_liquido: cab.total_liquido,
      comprovante_url,
      obra_nome: cab.obra_nome,
      fornecedor_nome: cab.fornecedor_nome,
      funcionario_nome: cab.funcionario_nome,
      itens
    });
  } catch (e) {
    console.error('GET /api/compras/:id', e);
    res.status(500).json({ error: 'Erro ao detalhar compra' });
  }
};

// CADASTRAR compra com múltiplos itens + gerar parcelas
// POST /api/compras
export const criarCompra = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const {
      obra_id,
      fornecedor_id,
      funcionario_id,
      data_compra,
      forma_pagamento,
      parcelas,
      data_vencimento,
      observacoes,
      desconto_total = 0
    } = req.body;

    let itens = [];
    try {
      itens = JSON.parse(req.body.itens || '[]');
    } catch {
      itens = [];
    }

    const ids = [obra_id, fornecedor_id, funcionario_id].map(Number);
    if (ids.some(v => !Number.isInteger(v) || v <= 0)) {
      return res.status(400).json({ error: 'IDs (obra, fornecedor, funcionário) inválidos.' });
    }

    const parc = Number(parcelas || 1);
    if (!Number.isInteger(parc) || parc < 1 || parc > 12) {
      return res.status(400).json({ error: 'Parcelas inválidas (1-12).' });
    }

    if (!['dinheiro', 'pix', 'cartao', 'boleto'].includes(String(forma_pagamento))) {
      return res.status(400).json({ error: 'Forma de pagamento inválida.' });
    }

    if (!Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ error: 'Informe ao menos um item.' });
    }

    const [[o]]  = await pool.query('SELECT id FROM obras WHERE id=? LIMIT 1', [obra_id]);
    const [[fo]] = await pool.query('SELECT id FROM fornecedores WHERE id=? LIMIT 1', [fornecedor_id]);
    const [[fu]] = await pool.query('SELECT id FROM funcionarios WHERE id=? LIMIT 1', [funcionario_id]);

    if (!o || !fo || !fu) {
      return res.status(400).json({ error: 'Obra/Fornecedor/Funcionário inexistente.' });
    }

    const fileName = req.file?.key || null;

    await conn.beginTransaction();

    const [rCab] = await conn.query(
      `
      INSERT INTO compras
        (obra_id, fornecedor_id, funcionario_id,
         data_compra, forma_pagamento, parcelas,
         data_vencimento, observacoes, desconto_total, total_liquido, comprovante_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?)
      `,
      [
        Number(obra_id),
        Number(fornecedor_id),
        Number(funcionario_id),
        data_compra,
        String(forma_pagamento),
        parc,
        data_vencimento,
        observacoes ?? null,
        Number(desconto_total) || 0,
        fileName
      ]
    );
    const compraId = rCab.insertId;

    let subtotal = 0;
    const stmtItem = `
      INSERT INTO compras_itens (compra_id, produto_id, quantidade, valor_unit, desconto_item)
      VALUES (?, ?, ?, ?, 0.00)
    `;

    for (const it of itens) {
      const produtoId  = Number(it.produtoId);
      const quantidade = Number(it.quantidade);
      const valorUnit  = Number(it.precoUnit);

      if (!produtoId || quantidade <= 0 || valorUnit <= 0) {
        throw new Error('Item inválido: produtoId, quantidade e precoUnit são obrigatórios e > 0.');
      }

      const [[pr]] = await conn.query('SELECT id FROM produtos WHERE id = ? LIMIT 1', [produtoId]);
      if (!pr) throw new Error(`Produto inexistente: ${produtoId}`);

      await conn.query(stmtItem, [compraId, produtoId, quantidade, valorUnit]);
      subtotal += quantidade * valorUnit;
    }

    const desconto = Number(desconto_total) || 0;
    const total    = Math.max(subtotal - desconto, 0);

    await conn.query(
      `UPDATE compras SET total_liquido = ? WHERE id = ?`,
      [total, compraId]
    );

    const valorParcelaBase = +(total / parc).toFixed(2);
    const somaBase = +(valorParcelaBase * parc).toFixed(2);
    let ajuste = +(total - somaBase).toFixed(2);

    let venc = new Date(data_vencimento);

    for (let i = 1; i <= parc; i++) {
      let valorParcela = valorParcelaBase;
      if (i === parc && ajuste !== 0) {
        valorParcela = +(valorParcelaBase + ajuste).toFixed(2);
      }

      const vencISO = venc.toISOString().slice(0,10);

      await conn.query(
        `
        INSERT INTO parcelas_compra (compra_id, numero_parcela, valor_parcela, data_vencimento)
        VALUES (?, ?, ?, ?)
        `,
        [compraId, i, valorParcela, vencISO]
      );

      venc.setMonth(venc.getMonth() + 1);
    }

    await conn.commit();

    res.status(201).json({
      id: compraId,
      subtotal,
      desconto_total: desconto,
      total_liquido: total,
      parcelas: parc
    });
  } catch (e) {
    await conn.rollback();
    console.error('POST /api/compras', e);
    res.status(500).json({ error: 'Erro ao registrar compra' });
  } finally {
    conn.release();
  }
};