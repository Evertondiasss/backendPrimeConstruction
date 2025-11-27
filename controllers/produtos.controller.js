// backend/controllers/produtos.controller.js
import pool from "../config/db.js";

// =====================================================
// GET /api/produtos  (listar com nome da categoria)
// =====================================================
export async function listarProdutos(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT 
         p.id, 
         p.nome, 
         p.categoria_id, 
         c.nome AS categoria_nome, 
         p.unidade_id
       FROM produtos p
       JOIN categorias c ON c.id = p.categoria_id
       ORDER BY c.nome, p.nome`
    );
    res.json(rows);
  } catch (e) {
    console.error("GET /api/produtos ERRO:", e.code, e.sqlMessage || e.message);
    res.status(500).json({ error: "Erro ao listar produtos" });
  }
}

// =====================================================
// POST /api/produtos  (cadastrar)
// =====================================================
export async function criarProduto(req, res) {
  try {
    const { nome, categoria_id, unidade_id } = req.body;

    if (!nome || !categoria_id) {
      return res
        .status(400)
        .json({ error: "Nome e categoria são obrigatórios" });
    }

    const nomeTrim = nome.trim();

    // Verifica se a categoria existe
    const [cat] = await pool.query(
      "SELECT id FROM categorias WHERE id = ? LIMIT 1",
      [categoria_id]
    );
    if (!cat.length) {
      return res.status(400).json({ error: "Categoria inexistente" });
    }

    // Verifica se a unidade existe (se enviada)
    if (unidade_id) {
      const [uni] = await pool.query(
        "SELECT id FROM unidades_medida WHERE id = ? LIMIT 1",
        [unidade_id]
      );
      if (!uni.length) {
        return res
          .status(400)
          .json({ error: "Unidade de medida inexistente" });
      }
    }

    // Evita duplicatas
    const [dup] = await pool.query(
      "SELECT id FROM produtos WHERE nome = ? AND categoria_id = ? LIMIT 1",
      [nomeTrim, categoria_id]
    );
    if (dup.length) {
      return res
        .status(409)
        .json({ error: "Produto já cadastrado nesta categoria" });
    }

    // Insere produto com unidade_id (pode ser null)
    const [result] = await pool.query(
      `INSERT INTO produtos (nome, categoria_id, unidade_id)
       VALUES (?, ?, ?)`,
      [nomeTrim, categoria_id, unidade_id ?? null]
    );

    res.status(201).json({ id: result.insertId });
  } catch (e) {
    console.error("POST /api/produtos ERRO:", e.code, e.sqlMessage || e.message);
    res.status(500).json({ error: "Erro ao cadastrar produto" });
  }
}

// =====================================================
// DELETE /api/produtos/:id  (excluir)
// =====================================================
export async function excluirProduto(req, res) {
  const { id } = req.params;

  try {
    const [exists] = await pool.query(
      "SELECT id FROM produtos WHERE id = ? LIMIT 1",
      [id]
    );
    if (!exists.length) {
      return res.status(404).json({ error: "Produto não encontrado" });
    }

    const [result] = await pool.query("DELETE FROM produtos WHERE id = ?", [
      id,
    ]);
    return res.json({ success: true, affected: result.affectedRows });
  } catch (e) {
    // FK (produto referenciado)
    if (
      e.code === "ER_ROW_IS_REFERENCED_2" ||
      e.code === "ER_ROW_IS_REFERENCED" ||
      e.errno === 1451
    ) {
      return res.status(409).json({
        error:
          "Não é possível excluir: produto vinculado a outros registros (compras/itens).",
      });
    }
    console.error("DELETE /api/produtos ERRO:", e.code, e.sqlMessage || e.message);
    return res.status(500).json({ error: "Erro ao excluir produto" });
  }
}
