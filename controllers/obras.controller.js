  // backend/controllers/obras.controller.js
  import pool from '../config/db.js';

  // Helper: obter obra por ID
  async function getObraById(id) {
    const [rows] = await pool.query(
      `
      SELECT o.id, o.nome, o.endereco,
            DATE_FORMAT(o.data_inicio,'%d/%m/%Y')   AS data_inicio,
            DATE_FORMAT(o.data_prevista,'%d/%m/%Y') AS data_prevista,
            o.responsavel_id, f.nome AS responsavel_nome,
            o.orcamento_estimado, 
            o.valor_contratual, 
            o.status,
            DATE_FORMAT(o.data_conclusao,'%d/%m/%Y') AS data_conclusao,
            DATE_FORMAT(o.cancelada_em,'%d-%m-%Y %H:%i:%s') AS cancelada_em,
            o.cancelada_por, o.motivo_cancelamento
        FROM obras o
  LEFT JOIN funcionarios f ON f.id = o.responsavel_id
      WHERE o.id = ?
      LIMIT 1
      `,
      [id]
    );
    return rows[0] || null;
  }

  // Helper: valida ID vindo da URL
  function parseIdParam(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'ID inválido' });
      return null;
    }
    return id;
  }

  // =========================
  // GET /api/obras
  // =========================
  export async function listarObras(req, res) {
    try {
      const [rows] = await pool.query(
        `
        SELECT o.id, o.nome, o.endereco,
              DATE_FORMAT(o.data_inicio,  '%d/%m/%Y') AS data_inicio,
              DATE_FORMAT(o.data_prevista,'%d/%m/%Y') AS data_prevista,
              o.responsavel_id, f.nome AS responsavel_nome,
              o.orcamento_estimado,
              o.valor_contratual,
              o.status,
              DATE_FORMAT(o.data_conclusao,'%d/%m/%Y') AS data_conclusao
          FROM obras o
    LEFT JOIN funcionarios f ON f.id = o.responsavel_id
      ORDER BY o.id DESC
        `
      );
      res.json(rows);
    } catch (e) {
      console.error('GET /api/obras ERRO:', e);
      res.status(500).json({ error: 'Erro ao listar obras' });
    }
  }

  // =========================
  // POST /api/obras
  // =========================
  export async function criarObra(req, res) {
    try {
      const {
        nome,
        endereco,
        data_inicio,
        data_prevista,
        responsavel_id,
        orcamento_estimado,
        valor_contratual
      } = req.body;

      if (
        !nome ||
        !endereco ||
        !data_inicio ||
        !data_prevista ||
        !responsavel_id ||
        orcamento_estimado == null ||
        valor_contratual == null
      ) {
        return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
      }

      const [fx] = await pool.query(
        'SELECT id FROM funcionarios WHERE id = ? LIMIT 1',
        [responsavel_id]
      );
      if (!fx.length) {
        return res.status(400).json({ error: 'Responsável inexistente.' });
      }

      const sql = `
        INSERT INTO obras
          (nome, endereco, data_inicio, data_prevista,
          responsavel_id, orcamento_estimado, valor_contratual, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'ativa')
      `;
      const [result] = await pool.query(sql, [
        nome.trim(),
        endereco.trim(),
        data_inicio,
        data_prevista,
        Number(responsavel_id),
        Number(orcamento_estimado),
        Number(valor_contratual)
      ]);

      res.status(201).json({ id: result.insertId });
    } catch (e) {
      console.error('POST /api/obras ERRO:', e);
      res.status(500).json({ error: 'Erro ao cadastrar obra' });
    }
  }

  // =========================
  // POST /api/obras/:id/pausar
  // =========================
  export async function pausarObra(req, res) {
    try {
      const id = parseIdParam(req, res);
      if (!id) return;

      const { motivo } = req.body || {};

      const [r] = await pool.query(
        `
        UPDATE obras
          SET status='pausada',
              pausada_em=NOW(),
              motivo_pausa=?
        WHERE id=? AND status='ativa'
        `,
        [motivo || null, id]
      );

      if (!r.affectedRows) {
        return res.status(400).json({ error: 'Obra não pode ser pausada' });
      }

      res.json({ ok: true, obra: await getObraById(id) });
    } catch (e) {
      console.error('POST /api/obras/:id/pausar ERRO:', e);
      res.status(500).json({ error: 'Erro ao pausar obra' });
    }
  }

  // =========================
  // POST /api/obras/:id/retomar
  // =========================
  export async function retomarObra(req, res) {
    try {
      const id = parseIdParam(req, res);
      if (!id) return;

      const [r] = await pool.query(
        `
        UPDATE obras
          SET status='ativa',
              motivo_pausa=NULL
        WHERE id=? AND status='pausada'
        `,
        [id]
      );

      if (!r.affectedRows) {
        return res.status(400).json({ error: 'Obra não pode ser retomada' });
      }

      res.json({ ok: true, obra: await getObraById(id) });
    } catch (e) {
      console.error('POST /api/obras/:id/retomar ERRO:', e);
      res.status(500).json({ error: 'Erro ao retomar obra' });
    }
  }

  // =========================
  // POST /api/obras/:id/finalizar
  // =========================
  export async function finalizarObra(req, res) {
    try {
      const id = parseIdParam(req, res);
      if (!id) return;

      const { motivo } = req.body || {};

      const [r] = await pool.query(
        `
        UPDATE obras
          SET status='concluida',
              data_conclusao=CURDATE()
        WHERE id=? AND status IN ('ativa','pausada')
        `,
        [id]
      );

      if (!r.affectedRows) {
        return res.status(400).json({ error: 'Obra não pode ser finalizada' });
      }

      res.json({ ok: true, motivo, obra: await getObraById(id) });
    } catch (e) {
      console.error('POST /api/obras/:id/finalizar ERRO:', e);
      res.status(500).json({ error: 'Erro ao finalizar obra' });
    }
  }

  // =========================
  // POST /api/obras/:id/cancelar
  // =========================
  export async function cancelarObra(req, res) {
    try {
      const id = parseIdParam(req, res);
      if (!id) return;

      const { motivo, usuario } = req.body || {};

      const [r] = await pool.query(
        `
        UPDATE obras
          SET status='cancelada',
              cancelada_em=NOW(),
              cancelada_por=?,
              motivo_cancelamento=?
        WHERE id=? AND status IN ('ativa','pausada')
        `,
        [usuario || 'sistema', motivo || null, id]
      );

      if (!r.affectedRows) {
        return res.status(400).json({ error: 'Obra não pode ser cancelada' });
      }

      res.json({ ok: true, obra: await getObraById(id) });
    } catch (e) {
      console.error('POST /api/obras/:id/cancelar ERRO:', e);
      res.status(500).json({ error: 'Erro ao cancelar obra' });
    }
  }

  // =========================
  // GET /api/obras/:id
  // =========================
  export async function obterObra(req, res) {
    try {
      const id = parseIdParam(req, res);
      if (!id) return;

      const obra = await getObraById(id);
      if (!obra) {
        return res.status(404).json({ error: 'Obra não encontrada' });
      }

      res.json(obra);
    } catch (e) {
      console.error('GET /api/obras/:id ERRO:', e);
      res.status(500).json({ error: 'Erro ao obter obra' });
    }
  }

  // =========================
  // PATCH /api/obras/:id/valores
  // =========================
  export async function atualizarValoresObra(req, res) {
    try {
      const id = parseIdParam(req, res);
      if (id == null) return;

      let { orcamento_estimado, valor_contratual } = req.body || {};

      if (orcamento_estimado == null || valor_contratual == null) {
        return res.status(400).json({
          error: 'Informe orcamento_estimado e valor_contratual'
        });
      }

      orcamento_estimado = Number(orcamento_estimado);
      valor_contratual   = Number(valor_contratual);

      if (Number.isNaN(orcamento_estimado) || orcamento_estimado < 0) {
        return res.status(400).json({ error: 'Orçamento estimado inválido' });
      }
      if (Number.isNaN(valor_contratual) || valor_contratual < 0) {
        return res.status(400).json({ error: 'Valor contratual inválido' });
      }

      const atual = await getObraById(id);
      if (!atual) {
        return res.status(404).json({ error: 'Obra não encontrada' });
      }

      const [r] = await pool.query(
        `
        UPDATE obras
          SET orcamento_estimado = ?,
              valor_contratual   = ?,
              updated_at         = NOW()
        WHERE id = ?
        `,
        [orcamento_estimado, valor_contratual, id]
      );

      if (!r.affectedRows) {
        return res.status(400).json({ error: 'Nenhuma linha alterada' });
      }

      const obra = await getObraById(id);
      res.json({ ok: true, obra });
    } catch (e) {
      console.error('PATCH /api/obras/:id/valores ERRO:', e);
      res.status(500).json({ error: 'Erro ao atualizar valores da obra' });
    }
  }
