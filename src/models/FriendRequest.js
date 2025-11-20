import mongoose from "mongoose";

const friendRequestSchema = new mongoose.Schema(
  {
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["pending", "accepted", "declined"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true },
);

// Một người chỉ có thể gửi 1 lời mời cho đối phương
friendRequestSchema.index({ from: 1, to: 1 }, { unique: true });

export default mongoose.model("FriendRequest", friendRequestSchema);
