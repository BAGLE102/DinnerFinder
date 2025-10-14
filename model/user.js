// models/User.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    lineUserId: { type: String, unique: true, index: true }, // LINE 的 userId
    displayName: String,
    lastLocation: {
      lat: Number,
      lng: Number,
      updatedAt: Date
    }
  },
  { timestamps: true }
);

// 既有專案常會同時用 named 與 default；兩個都輸出以避免 import 出錯
export const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
