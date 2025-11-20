import mongoose from "mongoose";

const friendshipSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    friendId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

friendshipSchema.index({ userId: 1, friendId: 1 }, { unique: true });
friendshipSchema.index({ friendId: 1, userId: 1 });

export default mongoose.model("Friendship", friendshipSchema);
