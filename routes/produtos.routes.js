    // backend/routes/produtos.routes.js
import { Router } from "express";
import {
  listarProdutos,
  criarProduto,
  excluirProduto,
} from "../controllers/produtos.controller.js";

const router = Router();

// GET /api/produtos
router.get("/", listarProdutos);

// POST /api/produtos
router.post("/", criarProduto);

// DELETE /api/produtos/:id
router.delete("/:id", excluirProduto);

export default router;
