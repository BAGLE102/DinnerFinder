import mongoose from 'mongoose';

export default async function connectMongoDB() {
  const uri = process.env.MONGO_URI;
  const dbName = process.env.MONGO_DB_NAME; // 建議設 line_dinner

  console.log('[Mongo] connecting to:', uri?.replace(/:\/\/.*@/, '://***@'));
  console.log('[Mongo] dbName option =', dbName || '(from URI)');

  await mongoose.connect(uri, {
    dbName,
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  mongoose.connection.on('connected', () => {
    console.log('=== MongoDB connected ===');
    console.log('[Mongo] effective db name =', mongoose.connection.name);
  });
}
