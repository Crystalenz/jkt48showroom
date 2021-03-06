let { Schema } = require("mongoose");

let userSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    default: "https://image.showroom-cdn.com/showroom-prod/assets/img/no_profile.jpg",
  },
  avatar_url: {
    type: String,
    default: "https://image.showroom-cdn.com/showroom-prod/image/avatar/1.png?v=87",
  },
  user_id: {
    type: Number,
    unique: true,
    required: true,
  },
  point: {
    type: Number,
    default: 0,
  },
  last_seen: {
    type: String,
  },
});

userSchema.index({ user_id: 1 }, { unique: true });

module.exports = {
  name: "Showroom_User",
  schema: userSchema,
};
