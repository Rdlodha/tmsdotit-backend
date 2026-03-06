const mongoose = require("mongoose");

const personalTaskSchema = new mongoose.Schema(
  {
    // Each personal task belongs to one user.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    image: {
      type: String,
      default: "",
      trim: true,
    },
    completed: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("PersonalTask", personalTaskSchema);
