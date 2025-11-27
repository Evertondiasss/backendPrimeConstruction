// backend/routes/recebimentos.routes.js
import { Router } from 'express';
import {
  listarRecebimentos,
  criarRecebimento,
  excluirRecebimento,
  uploadRecebimentos
} from '../controllers/recebimentos_obra.controller.js';

const router = Router();

router.get('/', listarRecebimentos);

router.post(
  '/',
  uploadRecebimentos.single('comprovante'),
  criarRecebimento
);

router.delete('/:id', excluirRecebimento);

export default router;
