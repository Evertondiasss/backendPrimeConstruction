// backend/routes/fornecedores.routes.js
import { Router } from "express";
import {
  listarFornecedores,
  criarFornecedor,
} from "../controllers/fornecedores.controller.js";

const router = Router();

// GET /api/fornecedores
router.get("/", listarFornecedores);

// POST /api/fornecedores
router.post("/", criarFornecedor);

export default router;
