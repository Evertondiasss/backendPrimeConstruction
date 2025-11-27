// backend/config/db.js
import { createPool } from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Pool de conexão com MySQL
const pool = createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || 'eVE1775*',
  database: process.env.DB_NAME || 'prime_construcoes',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true, // datas como 'YYYY-MM-DD'
});

// Teste de conexão (ping) ao subir o backend
(async () => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT 1 AS ok');
    console.log('✅ Ping MySQL (db.js):', rows);
    conn.release();
  } catch (err) {
    console.error(
      '❌ Erro ao conectar ao MySQL (db.js):',
      err.code,
      err.sqlMessage || err.message
    );
  }
})();

export default pool;
