import { Router } from "express";
import * as conversationController from "../controllers/conversationController.js";
import authMiddleware from "../middlewares/auth.middleware.js";

const router = Router();
router.use(authMiddleware);

router.post("/private", conversationController.createPrivate);
router.post("/group", conversationController.createGroup);

router.get("/", conversationController.list);
router.get("/:id", conversationController.detail);

router.post("/join", conversationController.joinByInvite);
router.delete("/:id", conversationController.deleteConversation);
router.put("/:id", conversationController.updateGroup);

router.post("/:id/leave", conversationController.leaveGroup);
router.delete("/:id/disband", conversationController.disbandGroup);
router.put("/:id/role", conversationController.updateRole);
router.post("/:id/add", conversationController.addMembers);
router.post("/:id/kick", conversationController.kickMember);

export default router;
