import mongoose from 'mongoose'
import config from './config.js'


export async function connectMongoDB() {
  // 1) 從環境變數讀，**不要**在程式裡硬寫 URI
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error('MONGO_URI is missing.');
    process.exit(1);
  }

  // 2) 事件監聽（方便排錯）
  mongoose.connection.on('connected', () => {
    console.log('=== MongoDB is connected ===');
  });
  mongoose.connection.on('disconnected', () => {
    console.log('=== MongoDB is disconnected ===');
  });
  mongoose.connection.on('close', () => {
    console.log('=== MongoDB connection closed ===');
  });
  mongoose.connection.on('error', (error) => {
    // 避免把整條 URI 打出來（遮住密碼）
    console.error('=== MongoDB connection error ===');
    console.error(error?.message || error);
    process.exit(1);
  });

  // 3) 直接 connect：v7/8 不需要那些舊 options
  // 如果你的 URI 已含 `/line_dinner`，就不要再另外指定 dbName
  await mongoose.connect(uri);
}

export default connectMongoDB;
