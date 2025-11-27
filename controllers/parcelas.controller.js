// controllers/parcelas.controller.js
import pool from '../config/db.js';

// GET /api/parcelas
export const listarParcelas = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        p.id,
        p.compra_id,
        p.numero_parcela,
        p.valor_parcela,
        DATE_FORMAT(p.data_vencimento,'%d/%m/%Y') AS data_vencimento,
        p.status_pagamento,
        DATE_FORMAT(p.data_pagamento,'%d/%m/%Y') AS data_pagamento,

        c.forma_pagamento,
        c.parcelas AS qtd_parcelas,
        c.total_liquido,

        o.nome AS obra_nome
      FROM parcelas_compra p
      JOIN compras  c ON c.id = p.compra_id
      JOIN obras    o ON o.id = c.obra_id
      ORDER BY p.data_vencimento ASC, p.id ASC
    `);

    res.json(rows);
  } catch (e) {
    console.error('GET /api/parcelas', e);
    res.status(500).json({ error: 'Erro ao listar parcelas' });
  }
};

// PUT /api/parcelas/:id/pagar
export const pagarParcela = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const [r] = await pool.query(
      `
      UPDATE parcelas_compra
      SET status_pagamento='pago', data_pagamento=CURDATE()
      WHERE id=?
      `,
      [id]
    );

    if (!r.affectedRows) {
      return res.status(404).json({ error: 'Parcela não encontrada' });
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('PUT /api/parcelas/:id/pagar', e);
    res.status(500).json({ error: 'Erro ao atualizar parcela' });
  }
};
