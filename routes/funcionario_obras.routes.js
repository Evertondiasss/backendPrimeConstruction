// routes/funcionario_obras.routes.js
import { Router } from 'express';
import { criarVinculoFuncionarioObra } from '../controllers/funcionario_obras.controller.js';

const router = Router();

router.post('/', criarVinculoFuncionarioObra);

export default router;
