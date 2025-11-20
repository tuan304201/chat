import { Router } from "express";
import * as friendController from "../controllers/friendController.js";
import authMiddleware from "../middlewares/auth.middleware.js";

const router = Router();
router.use(authMiddleware);

router.post("/send", friendController.sendRequest);
router.post("/accept", friendController.accept);
router.post("/decline", friendController.decline);
router.post("/cancel", friendController.cancel);
router.get("/requests", friendController.list);
router.post("/remove", friendController.unfriend);

export default router;
