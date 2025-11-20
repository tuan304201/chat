import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    displayName: {
      type: String,
      required: true,
      trim: true,
    },

    avatarUrl: {
      type: String,
      default: null,
    },

    bio: {
      type: String,
      default: "",
      maxlength: 200,
    },

    lastSeen: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model("User", userSchema);
