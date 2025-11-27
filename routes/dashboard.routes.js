// backend/routes/dashboard.routes.js
import { Router } from 'express';
import { getDashboard } from '../controllers/dashboard.controller.js';

const router = Router();

// GET /api/dashboard
router.get('/', getDashboard);

export default router; // <<--- ESSENCIAL: export default
