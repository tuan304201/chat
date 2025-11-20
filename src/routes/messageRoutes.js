import { Router } from "express";
import * as messageController from "../controllers/messageController.js";
import authMiddleware from "../middlewares/auth.middleware.js";

const router = Router();
router.use(authMiddleware);

router.post("/send", messageController.send);
router.get("/:conversationId", messageController.list);
router.put("/edit", messageController.edit);
router.delete("/remove", messageController.remove);

export default router;
