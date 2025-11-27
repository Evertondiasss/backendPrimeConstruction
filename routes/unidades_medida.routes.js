// routes/unidades_medida.routes.js
import { Router } from 'express';
import { listarUnidadesMedida } from '../controllers/unidades_medida.controller.js';

const router = Router();

router.get('/', listarUnidadesMedida);

export default router;
