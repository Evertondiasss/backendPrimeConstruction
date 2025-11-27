// backend/routes/obras.routes.js
import { Router } from 'express';
import {
  listarObras,
  criarObra,
  pausarObra,
  retomarObra,
  finalizarObra,
  cancelarObra,
  obterObra,
  atualizarValoresObra
} from '../controllers/obras.controller.js';

const router = Router();

// /api/obras
router.get('/', listarObras);
router.post('/', criarObra);

// /api/obras/:id/...
router.post('/:id/pausar', pausarObra);
router.post('/:id/retomar', retomarObra);
router.post('/:id/finalizar', finalizarObra);
router.post('/:id/cancelar', cancelarObra);
router.get('/:id', obterObra);
router.patch('/:id/valores', atualizarValoresObra);

export default router;
