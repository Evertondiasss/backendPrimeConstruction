// Prime Construções - Backend API
// Banco: MySQL (Workbench)

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';
import pool from './config/db.js';
import obrasRoutes from './routes/obras.routes.js';
import recebimentosRoutes from './routes/recebimentos_obra.routes.js';
import fornecedoresRoutes from "./routes/fornecedores.routes.js";
import categoriasRoutes from "./routes/categorias.routes.js";
import produtosRoutes from "./routes/produtos.routes.js";
import encargosRoutes from "./routes/encargos.routes.js";
import pagamentosRoutes from "./routes/pagamentos.routes.js";
import authRoutes from './routes/auth.routes.js';
import funcionariosRoutes from './routes/funcionarios.routes.js';
import comprasRoutes from './routes/compras.routes.js';
import parcelasRoutes from './routes/parcelas.routes.js';
import unidadeMedidaRoutes from './routes/unidades_medida.routes.js';
import relatoriosRoutes from './routes/relatorios_he.routes.js';
import funcionarioObrasRoutes from './routes/funcionario_obras.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';

const S3_BUCKET = process.env.S3_BUCKET;
dotenv.config();

const app = express();

// CORS antes das rotas
app.use(cors({
  origin: ['http://127.0.0.1:5500',
           'http://localhost:5500',
           'http://localhost:5173',
           'https://primeconstrucoes.netlify.app'],
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true
}));

app.options(/.*/, cors());

app.use(express.json());
app.use('/api', authRoutes);  
app.use('/api/obras', obrasRoutes);
app.use('/api/recebimentos_obra', recebimentosRoutes);
app.use("/api/fornecedores", fornecedoresRoutes);
app.use("/api/categorias", categoriasRoutes);
app.use("/api/produtos", produtosRoutes);
app.use("/api/encargos", encargosRoutes);
app.use("/api/pagamentos-funcionarios", pagamentosRoutes);
app.use('/api/funcionarios', funcionariosRoutes);
app.use('/api/compras', comprasRoutes);
app.use('/api/parcelas', parcelasRoutes);
app.use('/api/unidades_medida', unidadeMedidaRoutes);
app.use('/api/relatorios_he', relatoriosRoutes);
app.use('/api/funcionario_obras', funcionarioObrasRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use((req, res, next) => {
  if (req.method === 'POST' && req.url.startsWith('/api/pagamentos-funcionarios')) {
    console.log('Content-Type recebido:', req.headers['content-type']);
  }
  next();
});

// ===== Logger simples =====
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ===== Healthcheck =====
app.get('/health', async (req, res) => {
  try {
    const [db] = await pool.query('SELECT DATABASE() AS db');
    const [ver] = await pool.query('SELECT VERSION() AS version');
    res.json({ ok: true, db: db?.[0]?.db, version: ver?.[0]?.version });
  } catch (e) {
    console.error('HEALTH ERRO:', e.code, e.sqlMessage || e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ===== Home =====
app.get('/', (req, res) => {
  res.send('API Prime Construções está rodando 🚀');
});

// ===== Uploads base =====
const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');
fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
app.use('/uploads', express.static(UPLOADS_ROOT));

// POST /api/login

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  }

  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT * FROM usuarios WHERE login = ?', [username]);
    conn.release();

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
    }

    const user = rows[0];

    // compara o hash armazenado com a senha digitada
    const ok = await bcrypt.compare(password, user.senha);

    if (!ok) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
    }

    res.json({
      id: user.id,
      login: user.login,
      nome: user.nome,
    });
  } catch (err) {
    console.error('Erro no login:', err.message);
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

/* START */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});