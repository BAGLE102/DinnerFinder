import mongoose from 'mongoose';
const restaurantSchema = new mongoose.Schema({
  ownerUserId: { type: String, index: true }, // 來自 getOwnerKey()
  name: { type: String, index: true },
  address: String,
  placeId: { type: String, index: true },
  location: { lat: Number, lng: Number },
  rating: Number,
  source: { type: String, enum: ['manual', 'places'], default: 'manual' },
  timesChosen: { type: Number, default: 0 },
  lastChosenAt: Date,
}, { timestamps: true });

restaurantSchema.index({ ownerUserId: 1, name: 1 }, { unique: true, sparse: true });
const RestaurantModel = mongoose.models.Restaurant || mongoose.model('Restaurant', restaurantSchema);
export const Restaurant = RestaurantModel;
export default RestaurantModel;
