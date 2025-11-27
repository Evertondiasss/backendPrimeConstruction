// routes/parcelas.routes.js
import { Router } from 'express';
import {
  listarParcelas,
  pagarParcela,
} from '../controllers/parcelas.controller.js';

const router = Router();

router.get('/', listarParcelas);
router.put('/:id/pagar', pagarParcela);

export default router;
