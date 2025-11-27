// backend/routes/pagamentos.routes.js
import { Router } from "express";
import {
  listarPagamentos,
  criarPagamento,
  detalharPagamento,
  uploadPagamentosMiddleware,
} from "../controllers/pagamentos.controller.js";

const router = Router();

// GET /api/pagamentos-funcionarios
router.get("/", listarPagamentos);

// POST /api/pagamentos-funcionarios
router.post("/", uploadPagamentosMiddleware, criarPagamento);

// GET /api/pagamentos-funcionarios/:id
router.get("/:id", detalharPagamento);

export default router;
