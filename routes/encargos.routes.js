// backend/routes/encargos.routes.js
import { Router } from "express";
import multer from "multer";
import multerS3 from "multer-s3";
import { S3Client } from "@aws-sdk/client-s3";
import {
  listarEncargos,
  criarEncargo,
} from "../controllers/encargos.controller.js";

const router = Router();

// Config S3 para upload de encargos
const s3 = new S3Client({ region: process.env.AWS_REGION });
const S3_BUCKET = process.env.S3_BUCKET;

const uploadEncargos = multer({
  storage: multerS3({
    s3,
    bucket: S3_BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: (req, file, cb) => cb(null, { fieldName: file.fieldname }),
    key: (req, file, cb) => {
      const safe = file.originalname.replace(/[^\w.\-]+/g, "_");
      const prefix = process.env.S3_PREFIX_ENCARGOS || "encargos/";
      cb(null, `${prefix}${Date.now()}__${safe}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ok = ["application/pdf", "image/png", "image/jpeg"].includes(
      file.mimetype
    );
    if (ok) return cb(null, true);
    return cb(new Error("Formato inválido (PDF/PNG/JPG)."));
  },
});

// GET /api/encargos
router.get("/", listarEncargos);

// POST /api/encargos (com upload opcional de comprovante)
router.post("/", uploadEncargos.single("comprovante"), criarEncargo);

export default router;
