import { Router } from "express";
import * as userController from "../controllers/userController.js";
import authMiddleware from "../middlewares/auth.middleware.js";

const router = Router();
router.use(authMiddleware);

router.get("/me", userController.getProfile);
router.get("/search", userController.search);
router.put("/update", userController.updateProfile);
router.get("/friends", userController.friends);

export default router;
