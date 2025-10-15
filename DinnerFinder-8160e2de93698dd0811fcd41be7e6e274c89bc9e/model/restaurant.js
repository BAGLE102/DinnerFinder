import mongoose from 'mongoose';

const restaurantSchema = new mongoose.Schema({
  ownerUserId: { type: String, required: true, index: true }, // groupId/roomId/userId
  name:       { type: String, required: true },
  address:    { type: String },
  placeId:    { type: String, index: true, sparse: true },
  location:   {
    lat: { type: Number },
    lng: { type: Number }
  },
  rating:     { type: Number },
  source:     { type: String, enum: ['manual', 'places'], default: 'manual' },
  timesChosen:   { type: Number, default: 0 },
  lastChosenAt:  { type: Date }
}, { timestamps: true });

// 同擁有者下店名唯一
restaurantSchema.index({ ownerUserId: 1, name: 1 }, { unique: true, sparse: true });

// 鎖定集合名：restaurants
export default mongoose.model('Restaurant', restaurantSchema, 'restaurants');
