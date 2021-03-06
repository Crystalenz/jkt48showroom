let { Schema } = require("mongoose");

let giftSchema = new Schema({
  gift_id: {
    type: Number,
    unique: true,
    required: true,
  },
  gift_name: {
    type: String,
  },
  is_delete_from_stage: {
    type: Boolean,
  },
  free: {
    type: Boolean,
  },
  image: {
    type: String,
  },
  point: {
    type: Number,
    default: 0,
  },
});

giftSchema.index({ gift_id: 1 }, { unique: true });

module.exports = {
  name: "Showroom_Gift",
  schema: giftSchema,
};
