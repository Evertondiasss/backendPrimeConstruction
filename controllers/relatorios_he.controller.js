// controllers/relatorios.controller.js
import pool from '../config/db.js';

// GET /api/relatorios/horas-extras
export const relatorioHorasExtras = async (req, res) => {
  try {
    const { funcionario_id, competencia } = req.query;

    const where = ['1=1'];
    const params = [];

    if (funcionario_id) {
      where.push('p.funcionario_id = ?');
      params.push(Number(funcionario_id));
    }
    if (competencia) {
      where.push('DATE_FORMAT(p.competencia, "%Y-%m") = ?');
      params.push(String(competencia));
    }

    const [rows] = await pool.query(
      `
      SELECT 
        p.id                                  AS pagamento_id,
        p.funcionario_id,
        f.nome                                AS funcionario_nome,
        DATE_FORMAT(p.competencia,'%d/%m/%Y') AS competencia,
        e.obra_id,
        o.nome                                AS obra_nome,
        SUM(e.horas_qtd)                      AS horas_total,
        SUM(e.horas_qtd * e.valor_hora)       AS valor_total
      FROM pagamentos_horas_extras e
      JOIN pagamentos_funcionarios p ON p.id = e.pagamento_id
      JOIN funcionarios f           ON f.id = p.funcionario_id
      JOIN obras o                  ON o.id = e.obra_id
      WHERE ${where.join(' AND ')}
      GROUP BY p.id, p.funcionario_id, f.nome, p.competencia, e.obra_id, o.nome
      ORDER BY f.nome, p.competencia, o.nome
      `,
      params
    );

    const [totaisFunc] = await pool.query(
      `
      SELECT 
        p.funcionario_id,
        f.nome                          AS funcionario_nome,
        SUM(e.horas_qtd)                AS horas_total,
        SUM(e.horas_qtd * e.valor_hora) AS valor_total
      FROM pagamentos_horas_extras e
      JOIN pagamentos_funcionarios p ON p.id = e.pagamento_id
      JOIN funcionarios f           ON f.id = p.funcionario_id
      WHERE ${where.join(' AND ')}
      GROUP BY p.funcionario_id, f.nome
      ORDER BY f.nome
      `,
      params
    );

    res.json({ detalhes: rows, totais_por_funcionario: totaisFunc });
  } catch (e) {
    console.error('GET /api/relatorios/horas-extras', e);
    res.status(500).json({ error: 'Erro ao gerar relatório de horas extras' });
  }
};
