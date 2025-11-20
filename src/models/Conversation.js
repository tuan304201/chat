import mongoose from "mongoose";

const memberSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  role: {
    type: String,
    enum: ["member", "admin"],
    default: "member",
  },
});

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["private", "group"],
      required: true,
      index: true,
    },

    members: {
      type: [memberSchema],
      validate: (v) => v.length > 0,
    },

    title: {
      type: String,
      default: null,
    },

    avatar: {
      type: String,
      default: null,
    },

    // invite link dạng uuid
    inviteCode: {
      type: String,
      default: null,
      index: true,
    },

    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    settings: {
      joinApprovalRequired: { type: Boolean, default: false },
      onlyAdminCanChat: { type: Boolean, default: false },
    },
    pinnedMessages: [{ type: mongoose.Schema.Types.ObjectId, ref: "Message" }],
  },
  { timestamps: true },
);

// Tìm conversation 1-1 nhanh
conversationSchema.index({
  type: 1,
  "members.userId": 1,
});

export default mongoose.model("Conversation", conversationSchema);
