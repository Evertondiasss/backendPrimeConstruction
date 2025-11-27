// routes/relatorios.routes.js
import { Router } from 'express';
import { relatorioHorasExtras } from '../controllers/relatorios_he.controller.js';

const router = Router();

// /api/relatorios/horas-extras
router.get('/horas-extras', relatorioHorasExtras);

export default router;
