// backend/controllers/categorias.controller.js
import pool from "../config/db.js";

// ================================
// GET /api/categorias  (listar)
// ================================
export async function listarCategorias(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT id, nome
       FROM categorias
       ORDER BY nome`
    );
    res.json(rows);
  } catch (e) {
    console.error("GET /api/categorias ERRO:", e.code, e.sqlMessage || e.message);
    res.status(500).json({ error: "Erro ao listar categorias" });
  }
}

// ================================
// POST /api/categorias  (criar)
// ================================
export async function criarCategoria(req, res) {
  try {
    const { nome } = req.body;

    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ error: "Nome é obrigatório" });
    }

    const nomeTrim = nome.trim();

    const [dup] = await pool.query(
      "SELECT id FROM categorias WHERE nome = ? LIMIT 1",
      [nomeTrim]
    );

    if (dup.length) {
      return res.status(409).json({ error: "Categoria já existe" });
    }

    const [result] = await pool.query(
      "INSERT INTO categorias (nome) VALUES (?)",
      [nomeTrim]
    );

    res.status(201).json({ id: result.insertId });
  } catch (e) {
    console.error("POST /api/categorias ERRO:", e.code, e.sqlMessage || e.message);
    res.status(500).json({ error: "Erro ao cadastrar categoria" });
  }
}
