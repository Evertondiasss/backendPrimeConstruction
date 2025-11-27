// controllers/funcionarios.controller.js
import pool from '../config/db.js';

// GET /api/funcionarios
export const listarFuncionarios = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, nome, cpf, telefone,
              DATE_FORMAT(data_admissao, '%d/%m/%Y') AS data_admissao,
              cargo, salario
       FROM funcionarios
       ORDER BY nome`
    );
    res.json(rows);
  } catch (e) {
    console.error('GET /api/funcionarios ERRO:', e.code, e.sqlMessage || e.message);
    res.status(500).json({ error: 'Erro ao listar funcionários' });
  }
};

// POST /api/funcionarios
export const criarFuncionario = async (req, res) => {
  try {
    let { nome, cpf, telefone, data_admissao, cargo, salario } = req.body;

    if (!nome || !cpf || !telefone || !data_admissao || !cargo || salario == null) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios' });
    }

    cpf = String(cpf).replace(/\D/g, '');
    telefone = String(telefone).replace(/\D/g, '');
    const salarioNum = Number(salario);

    if (!/^\d{11}$/.test(cpf)) {
      return res.status(400).json({ error: 'CPF inválido (11 dígitos)' });
    }

    if (!/^\d{10,11}$/.test(telefone)) {
      return res.status(400).json({ error: 'Telefone inválido (10–11 dígitos)' });
    }

    if (Number.isNaN(salarioNum) || salarioNum < 0) {
      return res.status(400).json({ error: 'Salário inválido' });
    }

    const [dups] = await pool.query(
      'SELECT id FROM funcionarios WHERE cpf = ? LIMIT 1',
      [cpf]
    );
    if (dups.length) {
      return res.status(409).json({ error: 'CPF já cadastrado' });
    }

    const sql = `
      INSERT INTO funcionarios (nome, cpf, telefone, data_admissao, cargo, salario)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const [result] = await pool.query(sql, [
      nome,
      cpf,
      telefone,
      data_admissao,
      cargo,
      salarioNum
    ]);

    res.status(201).json({ id: result.insertId });
  } catch (e) {
    console.error('POST /api/funcionarios ERRO:', e.code, e.sqlMessage || e.message);
    res.status(500).json({ error: 'Erro ao cadastrar funcionário' });
  }
};
