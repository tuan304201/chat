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
      enum: ["text", "image", "file", "audio", "system"],
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

    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    isRecalled: {
      type: Boolean,
      default: false,
    },
    edited: { type: Boolean, default: false },
    deletedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    reactions: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        emoji: String, // 'LIKE', 'HEART', 'HAHA'...
      },
    ],
  },
  { timestamps: true },
);

// Lấy lịch sử chat hiệu quả (paging)
messageSchema.index({ conversationId: 1, createdAt: -1 });

export default mongoose.model("Message", messageSchema);
