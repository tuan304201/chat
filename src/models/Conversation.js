import mongoose from "mongoose";

const memberSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String, enum: ["member", "admin"], default: "member" },
  lastViewedAt: { type: Date, default: Date.now },
  hasUnseenReaction: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  leftAt: { type: Date, default: null },
});

const conversationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["private", "group"], required: true, index: true },
    members: { type: [memberSchema], validate: (v) => v.length > 0 },
    title: { type: String, default: null },
    avatar: { type: String, default: null },
    inviteCode: { type: String, default: null, index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
    isDisbanded: { type: Boolean, default: false },
    lastAction: {
      type: { type: String, enum: ["message", "reaction", "recall", "system"], default: "message" },
      text: String,
      sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      createdAt: { type: Date, default: Date.now },
    },

    settings: {
      joinApprovalRequired: { type: Boolean, default: false },
      onlyAdminCanChat: { type: Boolean, default: false },
    },
    pinnedMessages: [{ type: mongoose.Schema.Types.ObjectId, ref: "Message" }],
  },
  { timestamps: true },
);

conversationSchema.index({ type: 1, "members.userId": 1 });

export default mongoose.model("Conversation", conversationSchema);
