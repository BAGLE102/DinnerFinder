// config/mongo.js
import mongoose from 'mongoose';

function mask(str = '') {
  // mongodb+srv://user:pass@host/db?... → 遮掉帳密
  return str.replace(/(mongodb\+srv:\/\/)([^:]+):([^@]+)@/i, (_, p, u) => `${p}${u}:****@`);
}

export default async function connectMongoDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is missing');

  // 看清楚用的 dbName（若你用 config.mongo.database 就帶進來）
  const opts = {
    dbName: process.env.MONGO_DB_NAME,  // 若你用環境變數控制，或保留原本傳的 dbName
    useNewUrlParser: true,
    useUnifiedTopology: true,
    // autoIndex: true  // 初次建立索引時可打開
  };

  console.log('[Mongo] connecting to:', mask(uri), 'dbName=', opts.dbName || '(from URI)');
  await mongoose.connect(uri, opts);

  mongoose.connection.on('connected', () => {
    console.log('=== MongoDB connected ===');
    console.log('[Mongo] effective db name =', mongoose.connection.name); // ← 實際 DB 名
  });
  mongoose.connection.on('error', (err) => {
    console.error('=== MongoDB error ===', err);
  });
}
