// src/service/index.js
import updateUserLocation from './updateUserLocation.js';
import randomRestaurant from './randomRestaurant.js'; // 若你已不使用舊 random，可暫時保留
import exploreRestaurant from './exploreRestaurant.js';
import getMyRestaurant from './getMyRestaurant.js';
import chooseRestaurant from './chooseRestaurant.js';
import addRestaurant from './addRestaurant.js';
import removeRestaurant from './removeRestaurant.js';

export default {
  updateUserLocation,
  randomRestaurant,
  exploreRestaurant,
  getMyRestaurant,
  chooseRestaurant,
  addRestaurant,
  removeRestaurant
};
