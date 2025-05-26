import express from "express";
import * as settingController from "../controllers/settingController.js";

const router = express.Router();

router.get("/", settingController.getAllSettings);

router.get("/add", settingController.showAddSettingForm);

router.post("/", settingController.addSetting);

export default router;
