// controllers/funcionario_obras.controller.js
import pool from '../config/db.js';

// POST /api/funcionario_obras
export const criarVinculoFuncionarioObra = async (req, res) => {
  try {
    const {
      funcionario_id,
      obra_id,
      cargo_na_obra,
      data_inicio,
      data_fim,
      custo_hora_base,
      tipo_vinculo,
      ativo,
      observacoes
    } = req.body;

    console.log('Dados recebidos em /api/funcionario_obras:', req.body);

    const [result] = await pool.query(
      `
      INSERT INTO funcionario_obras 
        (funcionario_id, obra_id, cargo_na_obra, data_inicio, data_fim, 
         custo_hora_base, tipo_vinculo, ativo, observacoes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        funcionario_id,
        obra_id,
        cargo_na_obra || null,
        data_inicio || null,
        data_fim || null,
        custo_hora_base ?? 0,
        tipo_vinculo || 'CLT',
        ativo ? 1 : 0,
        observacoes || null
      ]
    );

    res.status(201).json({ message: 'Vinculação criada com sucesso', id: result.insertId });
  } catch (err) {
    console.error('Erro ao vincular funcionário à obra:', err);
    res.status(500).json({ error: 'Erro ao vincular funcionário à obra.' });
  }
};
