// backend/controllers/fornecedores.controller.js
import pool from '../config/db.js';

// =====================================================
// LISTAR fornecedores
// =====================================================
export async function listarFornecedores(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT id, nome, cnpj, endereco, telefone
       FROM fornecedores
       ORDER BY nome`
    );
    res.json(rows);
  } catch (e) {
    console.error("GET /api/fornecedores ERRO:", e.code, e.sqlMessage || e.message);
    res.status(500).json({ error: "Erro ao listar fornecedores." });
  }
}

// =====================================================
// CADASTRAR fornecedor
// =====================================================
export async function criarFornecedor(req, res) {
  try {
    const { nome, cnpj, endereco, telefone } = req.body;

    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ error: "Nome é obrigatório" });
    }

    const [result] = await pool.query(
      `INSERT INTO fornecedores (nome, cnpj, endereco, telefone)
       VALUES (?, ?, ?, ?)`,
      [nome.trim(), cnpj || null, endereco || null, telefone || null]
    );

    res.status(201).json({ id: result.insertId });
  } catch (e) {
    console.error("POST /api/fornecedores ERRO:", e.code, e.sqlMessage || e.message);
    res.status(500).json({ error: "Erro ao cadastrar fornecedor" });
  }
}
