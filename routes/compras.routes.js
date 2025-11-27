// routes/compras.routes.js
import { Router } from 'express';
import multer from 'multer';
import multerS3 from 'multer-s3';

import { s3 } from '../utils/s3.js';
import {
  listarCompras,
  detalharCompra,
  criarCompra,
} from '../controllers/compras.controller.js';

const router = Router();

const S3_BUCKET = process.env.S3_BUCKET;

// middleware de upload específico de compras
const uploadCompra = multer({
  storage: multerS3({
    s3,
    bucket: S3_BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: (req, file, cb) => cb(null, { fieldName: file.fieldname }),
    key: (req, file, cb) => {
      const safe = file.originalname.replace(/[^\w.\-]+/g, '_');
      const prefix = process.env.S3_PREFIX_COMPRAS || 'compras/';
      cb(null, `${prefix}${Date.now()}__${safe}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ok = ['application/pdf', 'image/png', 'image/jpeg'].includes(file.mimetype);
    if (ok) return cb(null, true);
    return cb(new Error('Formato inválido (PDF/PNG/JPG).'));
  },
});

// Rotas
router.get('/', listarCompras);
router.get('/:id', detalharCompra);
router.post('/', uploadCompra.single('comprovante'), criarCompra);

export default router;
