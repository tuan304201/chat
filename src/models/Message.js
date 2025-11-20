import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Conversation",
      index: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["text", "image", "file", "audio"],
      required: true,
    },

    text: {
      type: String,
      default: null,
    },

    fileUrl: {
      type: String,
      default: null,
    },

    metadata: {
      duration: { type: Number, default: null }, // audio
      size: { type: Number, default: null }, // file size
    },

    seenBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true },
);

// Lấy lịch sử chat hiệu quả (paging)
messageSchema.index({ conversationId: 1, createdAt: -1 });

export default mongoose.model("Message", messageSchema);
