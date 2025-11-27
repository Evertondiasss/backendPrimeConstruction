// controllers/unidades_medida.controller.js
import pool from '../config/db.js';

// GET /api/unidades_medida
export const listarUnidadesMedida = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, sigla, descricao FROM unidades_medida ORDER BY descricao'
    );
    res.json(rows);
  } catch (e) {
    console.error('GET /api/unidades_medida ERRO:', e);
    res.status(500).json({ error: 'Erro ao listar unidades' });
  }
};
