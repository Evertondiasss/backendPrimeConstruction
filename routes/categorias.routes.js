// backend/routes/categorias.routes.js
import { Router } from "express";
import {
  listarCategorias,
  criarCategoria,
} from "../controllers/categorias.controller.js";

const router = Router();

// GET /api/categorias
router.get("/", listarCategorias);

// POST /api/categorias
router.post("/", criarCategoria);

export default router;
