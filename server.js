// Prime Construções - Backend API
// Banco: MySQL (Workbench)

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';
import pool from './config/db.js';
import jwt from "jsonwebtoken";

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

dotenv.config();

// ======================
// MIDDLEWARE JWT
// ======================
function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ error: "Sem token" });

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

const app = express();

// ===== CORS =====
app.use(cors({
  origin: [
    'http://127.0.0.1:5500',
    'http://localhost:5500',
    'http://localhost:5173',
    'https://primeconstrucoes.netlify.app'
  ],
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true
}));

app.use(express.json());

// ======================
// ROTAS SEM AUTH
// ======================
app.use('/api', authRoutes);

// ======================
// ROTAS PROTEGIDAS
// ======================
app.use('/api/obras', auth, obrasRoutes);
app.use('/api/recebimentos_obra', auth, recebimentosRoutes);
app.use("/api/fornecedores", auth, fornecedoresRoutes);
app.use("/api/categorias", auth, categoriasRoutes);
app.use("/api/produtos", auth, produtosRoutes);
app.use("/api/encargos", auth, encargosRoutes);
app.use("/api/pagamentos-funcionarios", auth, pagamentosRoutes);
app.use('/api/funcionarios', auth, funcionariosRoutes);
app.use('/api/compras', auth, comprasRoutes);
app.use('/api/parcelas', auth, parcelasRoutes);
app.use('/api/unidades_medida', auth, unidadeMedidaRoutes);
app.use('/api/relatorios_he', auth, relatoriosRoutes);
app.use('/api/funcionario_obras', auth, funcionarioObrasRoutes);
app.use('/api/dashboard', auth, dashboardRoutes);

// ===== Logger =====
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

// ===== Static Uploads =====
const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');
fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
app.use('/uploads', express.static(UPLOADS_ROOT));


// ===== Start =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
