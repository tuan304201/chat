import { Router } from "express";
import * as conversationController from "../controllers/conversationController.js";
import authMiddleware from "../middlewares/auth.middleware.js";

const router = Router();
router.use(authMiddleware);

router.post("/private", conversationController.createPrivate);
router.post("/group", conversationController.createGroup);
router.post("/add-member", conversationController.addMember);
router.post("/remove-member", conversationController.removeMember);

router.get("/", conversationController.list);
router.get("/:id", conversationController.detail);

router.post("/join", conversationController.joinByInvite);

export default router;
