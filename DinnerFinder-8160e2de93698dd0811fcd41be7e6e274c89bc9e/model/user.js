import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  lineUserId: { type: String, required: true, index: true, unique: true },
  displayName: { type: String },
  lastLocation: {
    lat: Number,
    lng: Number,
    updatedAt: Date
  }
}, { timestamps: true });

// 鎖定集合名：users
export default mongoose.model('User', userSchema, 'users');
