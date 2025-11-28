// backend/controllers/auth.controller.js
import pool from "../config/db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// ================================
// POST /api/login
// ================================
export async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Usuário e senha são obrigatórios." });
    }

    const [rows] = await pool.query(
      "SELECT id, login, nome, senha FROM usuarios WHERE login = ? LIMIT 1",
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Usuário ou senha inválidos." });
    }

    const user = rows[0];

    const ok = await bcrypt.compare(password, user.senha);
    if (!ok) {
      return res.status(401).json({ error: "Usuário ou senha inválidos." });
    }

    // ================================
    // GERA TOKEN JWT
    // ================================
    const token = jwt.sign(
      { id: user.id, login: user.login },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.json({
      id: user.id,
      login: user.login,
      nome: user.nome,
      token,
    });

  } catch (e) {
    console.error("POST /api/login ERRO:", e.code, e.sqlMessage || e.message);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
}
